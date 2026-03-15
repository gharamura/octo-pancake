/**
 * Backfills the exchange_rates table with historical USD/EUR/etc → BRL rates.
 *
 * Sources:
 *   1. Every date that has a non-BRL asset balance in the DB
 *   2. End-of-month dates for every month of EXTRA_YEARS (full-year coverage)
 *
 * Uses AwesomeAPI (free, no key required) which covers BRL pairs including
 * LatAm currencies (ARS, CLP, COP, UYU) not available in Frankfurter.
 *
 * Run with:
 *   pnpm db:backfill-fx
 */

import { db } from "../lib/db";
import { exchangeRates } from "../lib/db/schema";
import { sql } from "drizzle-orm";

// Currencies to cover for the full-year sweep
const CURRENCIES = ["USD", "EUR", "GBP", "ARS", "CLP", "COP", "MXN", "UYU"];

// Years to generate end-of-month dates for (in addition to balance dates)
const EXTRA_YEARS = [2025];

const DELAY_MS = 400; // polite rate limit between API calls

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Last day of month as YYYY-MM-DD */
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of current
  return d.toISOString().slice(0, 10);
}

/** Generate end-of-month dates for every month of a given year */
function eomDatesForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => lastDayOfMonth(year, i + 1));
}

/**
 * Fetch the daily high/low midpoint from AwesomeAPI for a given currency→BRL
 * on a specific date (YYYY-MM-DD). Falls back to the most recent prior trading
 * day if the requested date is a weekend / holiday.
 */
async function fetchRate(
  currency: string,
  date: string,
): Promise<{ rate: number; actualDate: string } | null> {
  const compact = date.replace(/-/g, ""); // YYYYMMDD

  // Try exact date first (returns array; empty on non-trading days)
  const url = `https://economia.awesomeapi.com.br/json/daily/${currency}-BRL/5?start_date=${compact}&end_date=${compact}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`  [WARN] ${res.status} from AwesomeAPI for ${currency} on ${date}`);
      return null;
    }
    const data = (await res.json()) as Array<{
      high: string;
      low: string;
      bid: string;
      ask: string;
      create_date: string;
    }>;

    if (data.length > 0) {
      const mid = (parseFloat(data[0].high) + parseFloat(data[0].low)) / 2;
      return { rate: mid, actualDate: date };
    }

    // Weekend / holiday — fetch the 1 most recent record ending on that date
    const fallbackUrl = `https://economia.awesomeapi.com.br/json/daily/${currency}-BRL/1?end_date=${compact}`;
    const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(10_000) });
    if (!fallbackRes.ok) return null;
    const fallbackData = (await fallbackRes.json()) as typeof data;
    if (!fallbackData.length) return null;

    const mid = (parseFloat(fallbackData[0].high) + parseFloat(fallbackData[0].low)) / 2;
    // create_date is like "2025-01-03 13:05:00"
    const actualDate = fallbackData[0].create_date.slice(0, 10);
    return { rate: mid, actualDate };
  } catch (err) {
    console.warn(`  [WARN] Fetch error for ${currency} on ${date}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Backfill Exchange Rates ===\n");

  // 1a. Distinct (currency, date) pairs that have asset balances
  console.log("Querying account_balances for non-BRL asset balance dates...");
  const pairsResult = await db.execute(sql`
    SELECT DISTINCT
      a.currency,
      ab.date::text AS date
    FROM account_balances ab
    JOIN assets a ON a.id = ab.asset_id
    WHERE ab.asset_id IS NOT NULL
      AND a.currency <> 'BRL'
    ORDER BY a.currency, date
  `);

  const balancePairs = pairsResult.rows.map((r) => ({
    currency: r.currency as string,
    date:     String(r.date).slice(0, 10),
  }));
  console.log(`  Found ${balancePairs.length} balance-date pair(s).`);

  // 1b. End-of-month dates for extra years × all supported currencies
  const eomPairs: { currency: string; date: string }[] = [];
  for (const year of EXTRA_YEARS) {
    for (const date of eomDatesForYear(year)) {
      for (const currency of CURRENCIES) {
        eomPairs.push({ currency, date });
      }
    }
  }
  console.log(`  Generated ${eomPairs.length} end-of-month pair(s) for year(s): ${EXTRA_YEARS.join(", ")}.`);

  // Merge & deduplicate
  const seen = new Set<string>();
  const allPairs: { currency: string; date: string }[] = [];
  for (const p of [...balancePairs, ...eomPairs]) {
    const key = `${p.currency}|${p.date}`;
    if (!seen.has(key)) { seen.add(key); allPairs.push(p); }
  }
  // Sort: currency, then date
  allPairs.sort((a, b) => a.currency.localeCompare(b.currency) || a.date.localeCompare(b.date));
  console.log(`  Total unique pairs to consider: ${allPairs.length}.\n`);

  // 2. Existing rates — build a lookup set to skip what we already have
  const existingResult = await db.execute(sql`
    SELECT from_currency, to_currency, date::text AS date
    FROM exchange_rates
  `);
  const existingSet = new Set<string>(
    existingResult.rows.map((r) =>
      `${r.from_currency}|${r.to_currency}|${String(r.date).slice(0, 10)}`
    )
  );
  console.log(`${existingSet.size} rate(s) already in exchange_rates table.`);

  // 3. Filter to only pairs that are missing
  const todo = allPairs.filter(
    ({ currency, date }) => !existingSet.has(`${currency}|BRL|${date}`)
  );

  if (todo.length === 0) {
    console.log("All rates already present — nothing to fetch.");
    return;
  }
  console.log(`Need to fetch ${todo.length} rate(s).\n`);

  let inserted = 0;
  let skipped  = 0;

  for (const { currency, date: dateStr } of todo) {
    process.stdout.write(`  ${currency}/BRL  ${dateStr}  → `);

    const result = await fetchRate(currency, dateStr);

    if (!result) {
      console.log("skipped (no data available)");
      skipped++;
    } else {
      const { rate, actualDate } = result;
      const note = actualDate !== dateStr ? ` (using ${actualDate})` : "";

      await db.insert(exchangeRates).values({
        fromCurrency: currency,
        toCurrency:   "BRL",
        rate:         String(rate),
        date:         new Date(dateStr),
      }).onConflictDoNothing();

      console.log(`${rate.toFixed(4)}${note}`);
      inserted++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n=== Done. Inserted: ${inserted}  Skipped: ${skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
