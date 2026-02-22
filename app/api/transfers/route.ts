import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";

// POST /api/transfers
// Body: { id1: string; id2: string }
// Links two transfer transactions (COA 3110 / 3120) with a shared transferId.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id1, id2 } = await req.json();
  if (!id1 || !id2 || id1 === id2) {
    return NextResponse.json({ error: "Two distinct transaction IDs are required" }, { status: 400 });
  }

  const transferId = await transactionRepository.linkTransactions(id1, id2);
  return NextResponse.json({ transferId });
}
