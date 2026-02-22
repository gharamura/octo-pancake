import { auth } from "@/auth";
import { accountRepository } from "@/lib/repositories/account.repository";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name, type, institution, owner, accountNumber, openingBalance, notes, isActive } =
    await req.json();

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required." }, { status: 400 });
  }

  const account = await accountRepository.update(id, {
    name,
    type,
    institution: institution ?? null,
    owner: owner ?? null,
    accountNumber: accountNumber ?? null,
    openingBalance,
    notes: notes ?? null,
    isActive,
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await accountRepository.delete(id);

  if (!deleted) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
