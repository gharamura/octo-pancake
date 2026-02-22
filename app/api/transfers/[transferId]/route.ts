import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";

// DELETE /api/transfers/[transferId]
// Unlinks both legs of the transfer by setting transferId → null on both rows.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ transferId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transferId } = await params;
  await transactionRepository.unlinkTransfer(transferId);
  return NextResponse.json({ ok: true });
}
