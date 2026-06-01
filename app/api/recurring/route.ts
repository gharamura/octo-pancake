import { auth } from "@/auth";
import { recurringRepository } from "@/lib/repositories/recurring.repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await recurringRepository.findAll();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    name,
    amount,
    type,
    accountId,
    coaCode,
    recipientId,
    dayOfMonth,
    currency,
    isActive,
    notes,
  } = await req.json();

  if (!name || !amount || !type || !accountId || !dayOfMonth) {
    return NextResponse.json(
      { error: "name, amount, type, accountId, and dayOfMonth are required." },
      { status: 400 }
    );
  }

  const row = await recurringRepository.create({
    name,
    amount,
    type,
    accountId,
    coaCode: coaCode ?? null,
    recipientId: recipientId ?? null,
    dayOfMonth,
    currency: currency ?? "BRL",
    isActive: isActive ?? true,
    notes: notes ?? null,
  });

  return NextResponse.json(row, { status: 201 });
}
