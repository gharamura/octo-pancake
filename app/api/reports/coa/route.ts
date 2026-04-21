import { auth } from "@/auth";
import { db } from "@/lib/db";
import { coaAccounts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const year = parseInt(
    url.searchParams.get("year") ?? String(new Date().getFullYear()),
    10
  );

  const [accounts, agg] = await Promise.all([
    db.select().from(coaAccounts),
    db.execute(sql`
      SELECT
        t.coa_code,
        EXTRACT(MONTH FROM COALESCE(t.accounting_date, t.transaction_date))::int AS month,
        SUM(
          CASE
            WHEN t.currency = 'BRL' OR t.currency IS NULL THEN t.amount::numeric
            ELSE t.amount::numeric * COALESCE(er.rate, 1)
          END
        ) AS total
      FROM transactions t
      LEFT JOIN LATERAL (
        SELECT rate::numeric AS rate
        FROM exchange_rates
        WHERE from_currency = t.currency
          AND to_currency = 'BRL'
        ORDER BY ABS(date - COALESCE(t.accounting_date, t.transaction_date))
        LIMIT 1
      ) er ON t.currency <> 'BRL' AND t.currency IS NOT NULL
      WHERE EXTRACT(YEAR FROM COALESCE(t.accounting_date, t.transaction_date)) = ${year}
        AND t.coa_code IS NOT NULL
      GROUP BY t.coa_code, EXTRACT(MONTH FROM COALESCE(t.accounting_date, t.transaction_date))::int
    `),
  ]);

  // Build month-sum map: code → { month → value }
  const monthMap: Record<string, Record<number, number>> = {};
  for (const row of agg.rows) {
    const code  = row.coa_code as string;
    const month = Number(row.month);
    const total = parseFloat(String(row.total));
    if (!monthMap[code]) monthMap[code] = {};
    monthMap[code][month] = total;
  }

  const codesWithData = new Set(Object.keys(monthMap));

  // Determine which accounts are parents of accounts that have data
  const parentCodesWithChildren = new Set(
    accounts
      .filter((a) => a.parentCode && codesWithData.has(a.code))
      .map((a) => a.parentCode as string)
  );

  const report = accounts
    .filter((a) => codesWithData.has(a.code) || parentCodesWithChildren.has(a.code))
    .map((a) => {
      const isParent = parentCodesWithChildren.has(a.code);

      let months: Record<number, number>;
      if (isParent) {
        // Aggregate all children's months into the parent
        months = {};
        for (const child of accounts.filter((c) => c.parentCode === a.code)) {
          for (const [m, v] of Object.entries(monthMap[child.code] ?? {})) {
            months[Number(m)] = (months[Number(m)] ?? 0) + v;
          }
        }
      } else {
        months = monthMap[a.code] ?? {};
      }

      const total = Object.values(months).reduce((s, v) => s + v, 0);
      return {
        code:       a.code,
        name:       a.name,
        type:       a.type,
        parentCode: a.parentCode,
        months,
        total,
        isParent,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return NextResponse.json({ year, report });
}
