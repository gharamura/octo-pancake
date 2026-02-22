import { auth } from "@/auth";
import { coaRepository } from "@/lib/repositories/coa.repository";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const { name, type, parentCode, description, isActive } = await req.json();

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required." }, { status: 400 });
  }

  const account = await coaRepository.update(code, {
    name,
    type,
    parentCode: parentCode ?? null,
    description: description ?? null,
    isActive,
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const deleted = await coaRepository.delete(code);

  if (!deleted) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
