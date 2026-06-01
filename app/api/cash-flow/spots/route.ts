import { auth } from "@/auth";
import { spotsRepository } from "@/lib/repositories/spots.repository";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const year  = parseInt(url.searchParams.get("year")  ?? "", 10);
  const month = parseInt(url.searchParams.get("month") ?? "", 10);
  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: "year and month are required." }, { status: 400 });
  }

  const spots = await spotsRepository.findByMonth(year, month);
  return NextResponse.json(spots);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, amount, type, accountId, coaCode, year, month, dayOfMonth, currency, notes } = body;

  if (!name || !amount || !type || !accountId || !year || !month || !dayOfMonth) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const spot = await spotsRepository.create({
    name, amount, type, accountId,
    coaCode: coaCode ?? null,
    year, month, dayOfMonth,
    currency: currency ?? "BRL",
    notes: notes ?? null,
  });

  return NextResponse.json(spot, { status: 201 });
}
