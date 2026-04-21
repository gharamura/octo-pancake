import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const data = await transactionRepository.findAll({
    from: from ? new Date(from) : undefined,
    to:   to   ? new Date(to)   : undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionDate, accountingDate, accountId, coaCode, amount, currency, recipient, notes, assetId } =
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
    currency:  currency  || "BRL",
    recipient: recipient || null,
    notes:     notes     || null,
    assetId:   assetId   || null,
  });

  return NextResponse.json(transaction, { status: 201 });
}

// PATCH /api/transactions — bulk update coaCode, accountingDate and/or recipientId
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, coaCode, accountingDate, recipientId } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required." }, { status: 400 });
  }

  const data: { coaCode?: string | null; accountingDate?: Date | null; recipientId?: string | null } = {};
  if (coaCode !== undefined)        data.coaCode        = coaCode || null;
  if (accountingDate !== undefined) data.accountingDate = accountingDate ? new Date(accountingDate) : null;
  if (recipientId !== undefined)    data.recipientId    = recipientId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await transactionRepository.bulkUpdate(ids, data);
  return NextResponse.json({ ok: true, updated: ids.length });
}
