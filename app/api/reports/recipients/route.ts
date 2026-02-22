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
      EXTRACT(MONTH FROM t.transaction_date)::int AS month,
      SUM(t.amount::numeric)                       AS total
    FROM   transactions t
    JOIN   recipient_aliases ra ON ra.alias = t.recipient
    JOIN   recipients r         ON r.id     = ra.recipient_id
    WHERE  EXTRACT(YEAR FROM t.transaction_date) = ${year}
      AND  t.recipient IS NOT NULL
    GROUP  BY r.id, r.name,
              EXTRACT(MONTH FROM t.transaction_date)::int
    ORDER  BY r.name, month
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
    entry.months[month] = val;
    entry.total += val;
  }

  // Sort by absolute total descending (most active first)
  const report = Array.from(map.values()).sort(
    (a, b) => Math.abs(b.total) - Math.abs(a.total)
  );

  return NextResponse.json({ year, report });
}
