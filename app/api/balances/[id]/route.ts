import { auth } from "@/auth";
import { balanceRepository } from "@/lib/repositories/balance.repository";
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
  const { accountId, date, balance, notes } = await req.json();

  if (!accountId || !date || balance === undefined || balance === null || balance === "") {
    return NextResponse.json(
      { error: "accountId, date, and balance are required." },
      { status: 400 }
    );
  }

  const record = await balanceRepository.update(id, {
    accountId,
    date:    new Date(date),
    balance: String(balance),
    notes:   notes || null,
  });

  if (!record) {
    return NextResponse.json({ error: "Balance record not found." }, { status: 404 });
  }

  return NextResponse.json(record);
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
  const deleted = await balanceRepository.delete(id);

  if (!deleted) {
    return NextResponse.json({ error: "Balance record not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
