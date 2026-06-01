import { auth } from "@/auth";
import { spotsRepository } from "@/lib/repositories/spots.repository";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await spotsRepository.delete(id);
  return NextResponse.json({ ok: true });
}
