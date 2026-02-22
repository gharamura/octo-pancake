import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await transactionRepository.findAll();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionDate, accountingDate, accountId, coaCode, amount, recipient, notes } =
    await req.json();

  if (!transactionDate || !accountId || amount === undefined || amount === null || amount === "") {
    return NextResponse.json(
      { error: "transactionDate, accountId, and amount are required." },
      { status: 400 }
    );
  }

  const transaction = await transactionRepository.create({
    transactionDate: new Date(transactionDate),
    accountingDate:  accountingDate ? new Date(accountingDate) : null,
    accountId,
    coaCode:   coaCode   || null,
    amount:    String(amount),
    recipient: recipient || null,
    notes:     notes     || null,
  });

  return NextResponse.json(transaction, { status: 201 });
}
