import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";

// PATCH /api/transactions/[id]/recipient
// Body: { recipientId: string | null }
// Sets or clears the direct recipient link on a transaction.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { recipientId } = await req.json();

  const transaction = await transactionRepository.update(id, {
    recipientId: recipientId ?? null,
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/transactions/[id]/recipient
// Clears the direct recipient link.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const transaction = await transactionRepository.update(id, { recipientId: null });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
