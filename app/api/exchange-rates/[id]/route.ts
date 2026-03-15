import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await db
    .delete(exchangeRates)
    .where(eq(exchangeRates.id, id))
    .returning({ id: exchangeRates.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
