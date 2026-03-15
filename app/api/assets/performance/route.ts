import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export interface AssetDetail {
  id:       string;
  name:     string;
  currency: string;
  months:   Record<string, number>; // "yr:month" → BRL balance
}

export interface MonthPerf {
  year:                number;
  month:               number;
  label:               string;        // e.g. "Jan '25"
  balance:             number | null;
  prevBalance:         number | null;
  contributions:       number;
  withdrawals:         number;
  income:              number;
  pnl:                 number | null;
  returnPct:           number | null;
  cumulativeReturnPct: number | null;
}

export interface PerformanceResponse {
  from:         string | null; // "YYYY-MM" of first month shown
  to:           string | null; // "YYYY-MM" of last month shown
  assetCount:   number;
  startBalance: number | null;
  months:       MonthPerf[];
  assetDetails: AssetDetail[];
  ytd: {
    currentBalance: number | null;
    contributions:  number;
    withdrawals:    number;
    income:         number;
    pnl:            number | null;
    returnPct:      number | null;
  };
}

// ---------------------------------------------------------------------------
// GET /api/assets/performance?from=YYYY-MM&to=YYYY-MM&assetIds=id1,id2,...
// from/to are optional; omitting both means "all time".
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url       = new URL(req.url);
  const fromParam = url.searchParams.get("from"); // "YYYY-MM"
  const toParam   = url.searchParams.get("to");   // "YYYY-MM"
  const idsParam  = url.searchParams.get("assetIds") ?? "";
  const filterIds = new Set(idsParam ? idsParam.split(",").filter(Boolean) : []);

  const isAllTime = !fromParam || !toParam;

  let fromYear = 0, fromMonth = 0, toYear = 0, toMonth = 0;
  let prevYear = 0, prevMonth = 0;
  let fromYM   = 0, toYM     = 0;

  if (!isAllTime) {
    [fromYear, fromMonth] = fromParam!.split("-").map(Number);
    [toYear,   toMonth]   = toParam!.split("-").map(Number);
    fromYM   = fromYear * 100 + fromMonth;
    toYM     = toYear   * 100 + toMonth;
    prevMonth = fromMonth === 1 ? 12 : fromMonth - 1;
    prevYear  = fromMonth === 1 ? fromYear - 1 : fromYear;
  }

  // -- Balance query --------------------------------------------------------
  const balResult = await (isAllTime
    ? db.execute(sql`
        SELECT DISTINCT ON (
          ab.asset_id,
          EXTRACT(YEAR  FROM ab.date)::int,
          EXTRACT(MONTH FROM ab.date)::int
        )
          ab.asset_id,
          a.name      AS asset_name,
          a.currency,
          EXTRACT(YEAR  FROM ab.date)::int AS yr,
          EXTRACT(MONTH FROM ab.date)::int AS month,
          ab.balance::float                AS balance,
          CASE WHEN a.currency <> 'BRL' THEN (
            SELECT er.rate::float FROM exchange_rates er
            WHERE  er.from_currency = a.currency
              AND  er.to_currency   = 'BRL'
              AND  er.date         <= ab.date
            ORDER BY er.date DESC LIMIT 1
          ) ELSE 1.0 END AS fx_rate
        FROM account_balances ab
        JOIN assets a ON a.id = ab.asset_id
        WHERE ab.asset_id IS NOT NULL
        ORDER BY
          ab.asset_id,
          EXTRACT(YEAR  FROM ab.date)::int,
          EXTRACT(MONTH FROM ab.date)::int,
          ab.date DESC
      `)
    : db.execute(sql`
        SELECT DISTINCT ON (
          ab.asset_id,
          EXTRACT(YEAR  FROM ab.date)::int,
          EXTRACT(MONTH FROM ab.date)::int
        )
          ab.asset_id,
          a.name      AS asset_name,
          a.currency,
          EXTRACT(YEAR  FROM ab.date)::int AS yr,
          EXTRACT(MONTH FROM ab.date)::int AS month,
          ab.balance::float                AS balance,
          CASE WHEN a.currency <> 'BRL' THEN (
            SELECT er.rate::float FROM exchange_rates er
            WHERE  er.from_currency = a.currency
              AND  er.to_currency   = 'BRL'
              AND  er.date         <= ab.date
            ORDER BY er.date DESC LIMIT 1
          ) ELSE 1.0 END AS fx_rate
        FROM account_balances ab
        JOIN assets a ON a.id = ab.asset_id
        WHERE ab.asset_id IS NOT NULL
          AND (
            EXTRACT(YEAR FROM ab.date)::int * 100 + EXTRACT(MONTH FROM ab.date)::int
              BETWEEN ${fromYM} AND ${toYM}
            OR (
              EXTRACT(YEAR  FROM ab.date)::int = ${prevYear}
              AND EXTRACT(MONTH FROM ab.date)::int = ${prevMonth}
            )
          )
        ORDER BY
          ab.asset_id,
          EXTRACT(YEAR  FROM ab.date)::int,
          EXTRACT(MONTH FROM ab.date)::int,
          ab.date DESC
      `)
  );

  // -- Transaction query ----------------------------------------------------
  const txResult = await (isAllTime
    ? db.execute(sql`
        SELECT
          t.asset_id,
          EXTRACT(YEAR  FROM t.transaction_date)::int AS yr,
          EXTRACT(MONTH FROM t.transaction_date)::int AS month,
          t.coa_code,
          SUM(t.amount::float) AS total
        FROM transactions t
        WHERE t.asset_id IS NOT NULL
          AND t.coa_code IN ('1060', '4110', '4210')
        GROUP BY t.asset_id, yr, month, t.coa_code
      `)
    : db.execute(sql`
        SELECT
          t.asset_id,
          EXTRACT(YEAR  FROM t.transaction_date)::int AS yr,
          EXTRACT(MONTH FROM t.transaction_date)::int AS month,
          t.coa_code,
          SUM(t.amount::float) AS total
        FROM transactions t
        WHERE t.asset_id IS NOT NULL
          AND t.coa_code IN ('1060', '4110', '4210')
          AND EXTRACT(YEAR FROM t.transaction_date)::int * 100
            + EXTRACT(MONTH FROM t.transaction_date)::int
              BETWEEN ${fromYM} AND ${toYM}
        GROUP BY t.asset_id, yr, month, t.coa_code
      `)
  );

  // JS-side asset filter
  const balRows = filterIds.size > 0 ? balResult.rows.filter(r => filterIds.has(r.asset_id as string)) : balResult.rows;
  const txRows  = filterIds.size > 0 ? txResult.rows.filter(r  => filterIds.has(r.asset_id  as string)) : txResult.rows;

  // -- Build portfolio balance map + per-asset details ----------------------
  const portfolioBalance = new Map<string, number>(); // "yr:month" → BRL sum
  const assetDetailMap   = new Map<string, AssetDetail>();

  for (const row of balRows) {
    const yr    = Number(row.yr);
    const month = Number(row.month);
    const brl   = (row.balance as number) * ((row.fx_rate as number) ?? 1);
    const key   = `${yr}:${month}`;

    portfolioBalance.set(key, (portfolioBalance.get(key) ?? 0) + brl);

    // Only include months inside the target range in assetDetails (not prev month)
    const ym      = yr * 100 + month;
    const inRange = isAllTime || (ym >= fromYM && ym <= toYM);
    if (inRange) {
      const id = row.asset_id as string;
      if (!assetDetailMap.has(id)) {
        assetDetailMap.set(id, { id, name: row.asset_name as string, currency: row.currency as string, months: {} });
      }
      assetDetailMap.get(id)!.months[key] = brl;
    }
  }

  // -- Determine actual from/to from data (all-time mode) -------------------
  let actualFromYear: number, actualFromMonth: number, actualToYear: number, actualToMonth: number;

  if (isAllTime) {
    let minYM = Infinity, maxYM = -Infinity;
    for (const key of portfolioBalance.keys()) {
      const [y, m] = key.split(":").map(Number);
      const ym     = y * 100 + m;
      if (ym < minYM) { minYM = ym; }
      if (ym > maxYM) { maxYM = ym; }
    }
    if (minYM === Infinity) {
      // No data at all
      return NextResponse.json({ from: null, to: null, assetCount: 0, startBalance: null, months: [], assetDetails: [], ytd: { currentBalance: null, contributions: 0, withdrawals: 0, income: 0, pnl: null, returnPct: null } } satisfies PerformanceResponse);
    }
    actualFromYear  = Math.floor(minYM / 100);
    actualFromMonth = minYM % 100;
    actualToYear    = Math.floor(maxYM / 100);
    actualToMonth   = maxYM % 100;
  } else {
    actualFromYear  = fromYear;
    actualFromMonth = fromMonth;
    actualToYear    = toYear;
    actualToMonth   = toMonth;
  }

  // -- Build transaction map ------------------------------------------------
  const txByKey: Record<string, { contributions: number; withdrawals: number; income: number }> = {};
  for (const row of txRows) {
    const key = `${Number(row.yr)}:${Number(row.month)}`;
    if (!txByKey[key]) txByKey[key] = { contributions: 0, withdrawals: 0, income: 0 };
    const total = Number(row.total);
    if (row.coa_code === "4210") txByKey[key].contributions += Math.abs(total);
    if (row.coa_code === "4110") txByKey[key].withdrawals   += Math.abs(total);
    if (row.coa_code === "1060") txByKey[key].income        += total;
  }

  // -- Build monthly metrics ------------------------------------------------
  const monthsList: MonthPerf[] = [];
  let cumFactor = 1, hasCum = false;

  let y = actualFromYear, m = actualFromMonth;
  while (y < actualToYear || (y === actualToYear && m <= actualToMonth)) {
    const key         = `${y}:${m}`;
    const prevKey     = m === 1 ? `${y - 1}:12` : `${y}:${m - 1}`;
    const balance     = portfolioBalance.get(key)     ?? null;
    const prevBalance = portfolioBalance.get(prevKey) ?? null;
    const tx          = txByKey[key] ?? { contributions: 0, withdrawals: 0, income: 0 };

    let pnl: number | null = null, returnPct: number | null = null, cumulativeReturnPct: number | null = null;

    if (balance !== null && prevBalance !== null && prevBalance > 0) {
      pnl       = balance - prevBalance - tx.contributions + tx.withdrawals + tx.income;
      returnPct = (pnl / prevBalance) * 100;
      cumFactor *= 1 + returnPct / 100;
      hasCum    = true;
      cumulativeReturnPct = (cumFactor - 1) * 100;
    }

    monthsList.push({
      year: y, month: m,
      label:        `${MONTHS[m - 1]} '${String(y).slice(2)}`,
      balance,      prevBalance,
      contributions: tx.contributions,
      withdrawals:   tx.withdrawals,
      income:        tx.income,
      pnl, returnPct, cumulativeReturnPct,
    });

    m++; if (m > 12) { m = 1; y++; }
  }

  // -- YTD / period aggregates ----------------------------------------------
  const startKey    = actualFromMonth === 1 ? `${actualFromYear - 1}:12` : `${actualFromYear}:${actualFromMonth - 1}`;
  const startBalance = portfolioBalance.get(startKey) ?? null;
  const latestMonth  = monthsList.filter(m => m.balance !== null).at(-1);
  const ytdContrib   = monthsList.reduce((s, m) => s + m.contributions, 0);
  const ytdWithdr    = monthsList.reduce((s, m) => s + m.withdrawals,   0);
  const ytdIncome    = monthsList.reduce((s, m) => s + m.income,        0);
  const ytdPnl       = monthsList.reduce<number | null>((s, m) => m.pnl === null ? s : (s ?? 0) + m.pnl, null);

  const pad = (n: number) => String(n).padStart(2, "0");

  return NextResponse.json({
    from:         `${actualFromYear}-${pad(actualFromMonth)}`,
    to:           `${actualToYear}-${pad(actualToMonth)}`,
    assetCount:   assetDetailMap.size,
    startBalance,
    months:       monthsList,
    assetDetails: Array.from(assetDetailMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    ytd: {
      currentBalance: latestMonth?.balance ?? null,
      contributions:  ytdContrib,
      withdrawals:    ytdWithdr,
      income:         ytdIncome,
      pnl:            ytdPnl,
      returnPct:      hasCum ? (cumFactor - 1) * 100 : null,
    },
  } satisfies PerformanceResponse);
}
