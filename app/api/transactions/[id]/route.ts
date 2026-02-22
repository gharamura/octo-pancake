import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { transactionDate, accountingDate, accountId, coaCode, amount, currency, recipient, notes } =
    await req.json();

  if (!transactionDate || !accountId || amount === undefined || amount === null || amount === "") {
    return NextResponse.json(
      { error: "transactionDate, accountId, and amount are required." },
      { status: 400 }
    );
  }

  const transaction = await transactionRepository.update(id, {
    transactionDate: new Date(transactionDate),
    accountingDate:  accountingDate ? new Date(accountingDate) : null,
    accountId,
    coaCode:   coaCode   || null,
    amount:    String(amount),
    currency:  currency  || "BRL",
    recipient: recipient || null,
    notes:     notes     || null,
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json(transaction);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await transactionRepository.delete(id);

  if (!deleted) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
