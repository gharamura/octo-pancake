import { auth } from "@/auth";
import { recipientRepository } from "@/lib/repositories/recipient.repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await recipientRepository.findAll();
  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, notes } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const record = await recipientRepository.create({ name: name.trim(), notes: notes || null });
  return NextResponse.json(record, { status: 201 });
}
