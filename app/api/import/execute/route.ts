import { auth } from "@/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { NextResponse } from "next/server";

interface ImportRow {
  date:             string;
  description:      string;
  amount:           number;
  suggestedCoaCode: string | null;
  accountingDate?:  string | null;
  notes?:           string | null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, rows } = (await req.json()) as {
    accountId: string;
    rows:      ImportRow[];
  };

  if (!accountId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "accountId and rows are required." },
      { status: 400 }
    );
  }

  const values = rows.map((r) => ({
    transactionDate: new Date(r.date),
    accountingDate:  r.accountingDate ? new Date(r.accountingDate) : new Date(r.date),
    accountId,
    coaCode:         r.suggestedCoaCode ?? null,
    amount:          String(r.amount),
    recipient:       r.description.toUpperCase(),
    notes:           r.notes ?? null,
  }));

  await db.insert(transactions).values(values);

  return NextResponse.json({ inserted: values.length });
}
