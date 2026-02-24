import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountBalances } from "@/lib/db/schema";
import { NextResponse } from "next/server";

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
