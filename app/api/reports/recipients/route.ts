import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url  = new URL(req.url);
  const year = parseInt(
    url.searchParams.get("year") ?? String(new Date().getFullYear()),
    10
  );

  const { rows } = await db.execute(sql`
    SELECT
      r.id,
      r.name,
      EXTRACT(MONTH FROM COALESCE(t.accounting_date, t.transaction_date))::int AS month,
      SUM(t.amount::numeric)                                                    AS total
    FROM   transactions t
    JOIN   recipient_aliases ra ON ra.alias = t.recipient
    JOIN   recipients r         ON r.id     = ra.recipient_id
    WHERE  EXTRACT(YEAR FROM COALESCE(t.accounting_date, t.transaction_date)) = ${year}
      AND  t.recipient IS NOT NULL
      AND  t.recipient_id IS NULL
      AND  t.coa_code NOT IN ('3110', '3120', '3130')
    GROUP  BY r.id, r.name,
              EXTRACT(MONTH FROM COALESCE(t.accounting_date, t.transaction_date))::int
    UNION ALL
    SELECT
      r.id,
      r.name,
      EXTRACT(MONTH FROM COALESCE(t.accounting_date, t.transaction_date))::int AS month,
      SUM(t.amount::numeric)                                                    AS total
    FROM   transactions t
    JOIN   recipients r ON r.id = t.recipient_id
    WHERE  EXTRACT(YEAR FROM COALESCE(t.accounting_date, t.transaction_date)) = ${year}
      AND  t.recipient_id IS NOT NULL
      AND  t.coa_code NOT IN ('3110', '3120', '3130')
    GROUP  BY r.id, r.name,
              EXTRACT(MONTH FROM COALESCE(t.accounting_date, t.transaction_date))::int
    ORDER  BY name, month
  `);

  // Build id → { id, name, months, total }
  const map = new Map<string, {
    id:     string;
    name:   string;
    months: Record<number, number>;
    total:  number;
  }>();

  for (const row of rows) {
    const id    = row.id    as string;
    const name  = row.name  as string;
    const month = Number(row.month);
    const val   = parseFloat(String(row.total));

    if (!map.has(id)) map.set(id, { id, name, months: {}, total: 0 });
    const entry = map.get(id)!;
    entry.months[month] = (entry.months[month] ?? 0) + val;
    entry.total += val;
  }

  const all = Array.from(map.values());

  // Expenses: recipients with negative total (sort most negative first)
  const expenses = all
    .filter((r) => r.total < 0)
    .sort((a, b) => a.total - b.total);

  // Income: recipients with positive total (sort largest first)
  const income = all
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ year, expenses, income });
}
