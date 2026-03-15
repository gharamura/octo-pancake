import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountBalances } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/balances/assets?from=YYYY-MM&to=YYYY-MM
// Returns the latest balance per asset per month for the given period.
// Backwards-compatible: also accepts ?year=YYYY (equivalent to full year).
// ---------------------------------------------------------------------------

/** Key for months map is "YYYY-MM" string */
export interface AssetBalanceReportRow {
  assetId:       string;
  name:          string;
  assetClass:    string | null;
  currency:      string;
  accountId:     string;
  accountName:   string | null;
  months:        Record<string, number>;        // "YYYY-MM" → balance
  exchangeRates: Record<string, number | null>; // "YYYY-MM" → rate to BRL
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);

  // Determine date range
  let fromDate: string;
  let toDate: string;

  const fromParam = url.searchParams.get("from");
  const toParam   = url.searchParams.get("to");
  const yearParam = url.searchParams.get("year");

  if (fromParam && toParam) {
    // from=2025-10&to=2026-03 → first day of from month to last day of to month
    fromDate = `${fromParam}-01`;
    const [toY, toM] = toParam.split("-").map(Number);
    const lastDay = new Date(toY, toM, 0).getDate();
    toDate = `${toParam}-${String(lastDay).padStart(2, "0")}`;
  } else {
    const year = parseInt(yearParam ?? String(new Date().getFullYear()), 10);
    fromDate = `${year}-01-01`;
    toDate   = `${year}-12-31`;
  }

  const result = await db.execute(sql`
    SELECT
      a.id          AS asset_id,
      a.name,
      a.asset_class,
      a.currency,
      a.account_id,
      f.name        AS account_name,
      TO_CHAR(ab.date, 'YYYY-MM') AS month_key,
      ab.balance,
      CASE WHEN a.currency <> 'BRL' THEN (
        SELECT er.rate::float
        FROM exchange_rates er
        WHERE er.from_currency = a.currency
          AND er.to_currency   = 'BRL'
          AND er.date         <= ab.date
        ORDER BY er.date DESC
        LIMIT 1
      ) ELSE NULL END AS exchange_rate
    FROM (
      SELECT DISTINCT ON (asset_id, TO_CHAR(date, 'YYYY-MM'))
        asset_id,
        date,
        balance
      FROM account_balances
      WHERE asset_id IS NOT NULL
        AND date >= ${fromDate}::date
        AND date <= ${toDate}::date
      ORDER BY asset_id, TO_CHAR(date, 'YYYY-MM'), date DESC
    ) ab
    JOIN assets a ON a.id = ab.asset_id
    LEFT JOIN financial_accounts f ON f.id = a.account_id
    ORDER BY f.name NULLS LAST, a.name, month_key
  `);

  const assetMap = new Map<string, AssetBalanceReportRow>();
  for (const row of result.rows) {
    const id = row.asset_id as string;
    if (!assetMap.has(id)) {
      assetMap.set(id, {
        assetId:       id,
        name:          row.name         as string,
        assetClass:    row.asset_class  as string | null,
        currency:      row.currency     as string,
        accountId:     row.account_id   as string,
        accountName:   row.account_name as string | null,
        months:        {},
        exchangeRates: {},
      });
    }
    const key = row.month_key as string;
    assetMap.get(id)!.months[key]        = parseFloat(String(row.balance));
    assetMap.get(id)!.exchangeRates[key] = row.exchange_rate != null
      ? parseFloat(String(row.exchange_rate))
      : null;
  }

  return NextResponse.json({ from: fromDate, to: toDate, assets: Array.from(assetMap.values()) });
}

interface AssetBalanceRow {
  assetId:  string;
  balance:  string | number;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, date, rows } = await req.json() as {
    accountId: string;
    date:      string;
    rows:      AssetBalanceRow[];
  };

  if (!accountId || !date || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "accountId, date and rows are required." },
      { status: 400 }
    );
  }

  const values = rows
    .filter((r) => r.balance !== "" && r.balance !== null && r.balance !== undefined)
    .map((r) => ({
      accountId,
      assetId: r.assetId,
      date:    new Date(date),
      balance: String(r.balance),
      notes:   null,
    }));

  if (values.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  await db.insert(accountBalances).values(values);

  return NextResponse.json({ inserted: values.length });
}
