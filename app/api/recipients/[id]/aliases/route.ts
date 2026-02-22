import { auth } from "@/auth";
import { recipientRepository } from "@/lib/repositories/recipient.repository";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { alias } = await req.json();

  if (!alias?.trim()) {
    return NextResponse.json({ error: "alias is required." }, { status: 400 });
  }

  try {
    const record = await recipientRepository.addAlias(alias.trim(), id);
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Alias already exists." }, { status: 409 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params; // [id] not needed — alias is globally unique
  const { alias } = await req.json();

  if (!alias?.trim()) {
    return NextResponse.json({ error: "alias is required." }, { status: 400 });
  }

  const deleted = await recipientRepository.removeAlias(alias.trim());
  if (!deleted) return NextResponse.json({ error: "Alias not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
