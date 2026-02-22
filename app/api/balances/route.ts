import { auth } from "@/auth";
import { balanceRepository } from "@/lib/repositories/balance.repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await balanceRepository.findAll();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId, date, balance, notes } = await req.json();

  if (!accountId || !date || balance === undefined || balance === null || balance === "") {
    return NextResponse.json(
      { error: "accountId, date, and balance are required." },
      { status: 400 }
    );
  }

  const record = await balanceRepository.create({
    accountId,
    date:    new Date(date),
    balance: String(balance),
    notes:   notes || null,
  });

  return NextResponse.json(record, { status: 201 });
}
