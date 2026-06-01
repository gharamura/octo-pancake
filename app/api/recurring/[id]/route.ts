import { auth } from "@/auth";
import { recurringRepository } from "@/lib/repositories/recurring.repository";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await recurringRepository.findById(id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const row = await recurringRepository.update(id, {
    name:        body.name,
    amount:      body.amount,
    type:        body.type,
    accountId:   body.accountId,
    coaCode:     body.coaCode ?? null,
    recipientId: body.recipientId ?? null,
    dayOfMonth:  body.dayOfMonth,
    currency:    body.currency,
    isActive:    body.isActive,
    notes:       body.notes ?? null,
  });

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await recurringRepository.delete(id);
  if (!deleted) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
