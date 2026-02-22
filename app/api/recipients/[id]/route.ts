import { auth } from "@/auth";
import { recipientRepository } from "@/lib/repositories/recipient.repository";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, notes, isActive } = await req.json();

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
  }

  const record = await recipientRepository.update(id, {
    ...(name      !== undefined && { name: name.trim() }),
    ...(notes     !== undefined && { notes: notes || null }),
    ...(isActive  !== undefined && { isActive }),
  });

  if (!record) return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  return NextResponse.json(record);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await recipientRepository.delete(id);
  if (!deleted) return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
