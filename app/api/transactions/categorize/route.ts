import { auth } from "@/auth";
import { transactionRepository } from "@/lib/repositories/transaction.repository";
import { NextResponse } from "next/server";

/**
 * POST /api/transactions/categorize
 * Body: { id: string; coaCode: string }[]
 * Applies a specific coaCode to each transaction individually.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items: { id: string; coaCode: string }[] = await req.json();

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  await Promise.all(
    items.map(({ id, coaCode }) => transactionRepository.update(id, { coaCode }))
  );

  return NextResponse.json({ ok: true, updated: items.length });
}
