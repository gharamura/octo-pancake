import { auth } from "@/auth";
import { accountRepository } from "@/lib/repositories/account.repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await accountRepository.findAll();
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, type, institution, owner, accountNumber, currency, openingBalance, notes, isActive } =
    await req.json();

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required." }, { status: 400 });
  }

  const account = await accountRepository.create({
    name,
    type,
    institution: institution ?? null,
    owner: owner ?? null,
    accountNumber: accountNumber ?? null,
    currency: currency ?? "BRL",
    openingBalance: openingBalance ?? "0",
    notes: notes ?? null,
    isActive: isActive ?? true,
  });

  return NextResponse.json(account, { status: 201 });
}
