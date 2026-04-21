import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountBalances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// PATCH /api/balances/assets/entries/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id }             = await params;
  const { date, balance, notes } = await req.json();

  if (!date || balance == null) {
    return NextResponse.json({ error: "date and balance are required" }, { status: 400 });
  }

  await db
    .update(accountBalances)
    .set({ date: new Date(date), balance: String(balance), notes: notes ?? null })
    .where(eq(accountBalances.id, id));

  return NextResponse.json({ ok: true });
}

// DELETE /api/balances/assets/entries/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(accountBalances).where(eq(accountBalances.id, id));

  return NextResponse.json({ ok: true });
}
