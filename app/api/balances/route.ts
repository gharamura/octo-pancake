import { auth } from "@/auth";
import { balanceRepository } from "@/lib/repositories/balance.repository";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from       = searchParams.get("from");
  const to         = searchParams.get("to");
  const accountIds = searchParams.get("accountIds");

  const data = await balanceRepository.findAll({
    from:       from       ? new Date(from)                : undefined,
    to:         to         ? new Date(to)                  : undefined,
    accountIds: accountIds ? accountIds.split(",")         : undefined,
  });
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
