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
