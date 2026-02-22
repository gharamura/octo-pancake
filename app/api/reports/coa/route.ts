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
        coa_code,
        EXTRACT(MONTH FROM transaction_date)::int AS month,
        SUM(amount::numeric)                       AS total
      FROM transactions
      WHERE EXTRACT(YEAR FROM transaction_date) = ${year}
        AND coa_code IS NOT NULL
      GROUP BY coa_code, EXTRACT(MONTH FROM transaction_date)::int
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

  const report = accounts
    .filter((a) => codesWithData.has(a.code))
    .map((a) => {
      const months = monthMap[a.code] ?? {};
      const total  = Object.values(months).reduce((s, v) => s + v, 0);
      return {
        code:       a.code,
        name:       a.name,
        type:       a.type,
        parentCode: a.parentCode,
        months,
        total,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return NextResponse.json({ year, report });
}
