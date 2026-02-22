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
  const { coaCode, isPrimary } = await req.json();

  if (!coaCode?.trim()) {
    return NextResponse.json({ error: "coaCode is required." }, { status: 400 });
  }

  try {
    const record = await recipientRepository.addCoa(id, coaCode.trim(), !!isPrimary);
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "COA link already exists." }, { status: 409 });
  }
}
