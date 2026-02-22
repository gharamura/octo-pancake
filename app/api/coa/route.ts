import { auth } from "@/auth";
import { coaRepository } from "@/lib/repositories/coa.repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await coaRepository.findAll();
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, name, type, parentCode, description, isActive } = await req.json();

  if (!code || !name || !type) {
    return NextResponse.json({ error: "code, name and type are required." }, { status: 400 });
  }

  const existing = await coaRepository.findByCode(code);
  if (existing) {
    return NextResponse.json({ error: `Code "${code}" is already in use.` }, { status: 409 });
  }

  const account = await coaRepository.create({
    code,
    name,
    type,
    parentCode: parentCode ?? null,
    description: description ?? null,
    isActive: isActive ?? true,
  });

  return NextResponse.json(account, { status: 201 });
}
