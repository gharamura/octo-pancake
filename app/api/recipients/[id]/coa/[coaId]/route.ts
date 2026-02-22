import { auth } from "@/auth";
import { recipientRepository } from "@/lib/repositories/recipient.repository";
import { NextResponse } from "next/server";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string; coaId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, coaId } = await params;
  const record = await recipientRepository.setPrimary(coaId, id);
  if (!record) return NextResponse.json({ error: "COA link not found." }, { status: 404 });
  return NextResponse.json(record);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; coaId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coaId } = await params;
  const deleted = await recipientRepository.removeCoa(coaId);
  if (!deleted) return NextResponse.json({ error: "COA link not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
