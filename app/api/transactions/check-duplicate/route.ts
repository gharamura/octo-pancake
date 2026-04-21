import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date      = searchParams.get("date");
  const accountId = searchParams.get("accountId");
  const amount    = searchParams.get("amount");

  if (!date || !accountId || !amount) {
    return NextResponse.json({ error: "date, accountId and amount are required." }, { status: 400 });
  }

  const parsed = parseFloat(amount);
  if (isNaN(parsed)) {
    return NextResponse.json({ duplicates: [] });
  }

  const duplicates = await transactionRepository.findDuplicates(new Date(date), accountId, amount);
  return NextResponse.json({ duplicates });
}
