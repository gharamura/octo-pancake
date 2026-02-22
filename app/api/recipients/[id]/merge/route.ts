import { auth } from "@/auth";
import { recipientRepository } from "@/lib/repositories/recipient.repository";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sourceId } = await params;
  const { targetId } = await req.json();

  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "targetId is required." }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: "Cannot merge a recipient into itself." }, { status: 400 });
  }

  await recipientRepository.merge(sourceId, targetId);
  return new NextResponse(null, { status: 204 });
}
