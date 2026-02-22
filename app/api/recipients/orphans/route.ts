import { auth } from "@/auth";
import { db } from "@/lib/db";
import { coaAccounts, recipientAliases, transactions } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      recipient:        transactions.recipient,
      txCount:          sql<number>`count(*)::int`,
      total:            sql<number>`sum(${transactions.amount}::numeric)`,
      suggestedCoaCode: sql<string | null>`mode() within group (order by ${transactions.coaCode})`,
    })
    .from(transactions)
    .where(
      sql`${transactions.recipient} is not null
        and ${transactions.recipient} not in (
          select ${recipientAliases.alias} from ${recipientAliases}
        )`
    )
    .groupBy(transactions.recipient)
    .orderBy(sql`count(*) desc`);

  // Resolve COA names for suggested codes
  const codes = [...new Set(rows.map((r) => r.suggestedCoaCode).filter(Boolean))] as string[];
  const coaRows = codes.length
    ? await db.select({ code: coaAccounts.code, name: coaAccounts.name }).from(coaAccounts).where(inArray(coaAccounts.code, codes))
    : [];
  const coaNameByCode = new Map(coaRows.map((c) => [c.code, c.name]));

  const enriched = rows.map((r) => ({
    ...r,
    suggestedCoaName: r.suggestedCoaCode ? (coaNameByCode.get(r.suggestedCoaCode) ?? null) : null,
  }));

  return NextResponse.json(enriched);
}
