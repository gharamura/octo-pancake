import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// Credit-card accounts are liabilities; everything else is treated as an asset.
const LIABILITY_TYPES = new Set(["credit_card"]);

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
      fa.id,
      fa.name,
      fa.type,
      EXTRACT(MONTH FROM t.transaction_date)::int                                          AS month,
      SUM(CASE WHEN t.amount::numeric > 0 THEN  t.amount::numeric ELSE 0 END)::numeric    AS received,
      SUM(CASE WHEN t.amount::numeric < 0 THEN -t.amount::numeric ELSE 0 END)::numeric    AS paid
    FROM   transactions t
    JOIN   financial_accounts fa ON fa.id = t.account_id
    WHERE  EXTRACT(YEAR FROM t.transaction_date) = ${year}
    GROUP  BY fa.id, fa.name, fa.type,
              EXTRACT(MONTH FROM t.transaction_date)::int
    ORDER  BY fa.name, month
  `);

  const map = new Map<string, {
    id:            string;
    name:          string;
    type:          string;
    months:        Record<number, { received: number; paid: number }>;
    totalReceived: number;
    totalPaid:     number;
  }>();

  for (const row of rows) {
    const id       = row.id   as string;
    const name     = row.name as string;
    const type     = row.type as string;
    const month    = Number(row.month);
    const received = parseFloat(String(row.received));
    const paid     = parseFloat(String(row.paid));

    if (!map.has(id)) map.set(id, { id, name, type, months: {}, totalReceived: 0, totalPaid: 0 });
    const entry = map.get(id)!;
    entry.months[month]   = { received, paid };
    entry.totalReceived  += received;
    entry.totalPaid      += paid;
  }

  const all         = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  const assets      = all.filter((a) => !LIABILITY_TYPES.has(a.type));
  const liabilities = all.filter((a) =>  LIABILITY_TYPES.has(a.type));

  return NextResponse.json({ year, assets, liabilities });
}
