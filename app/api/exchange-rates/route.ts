import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.date), exchangeRates.fromCurrency);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fromCurrency, toCurrency = "BRL", rate, date } = await req.json();

  if (!fromCurrency || !rate || !date) {
    return NextResponse.json(
      { error: "fromCurrency, rate, and date are required." },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(exchangeRates)
    .values({
      fromCurrency,
      toCurrency,
      rate:  String(rate),
      date:  new Date(date),
    })
    .onConflictDoUpdate({
      target: [exchangeRates.fromCurrency, exchangeRates.toCurrency, exchangeRates.date],
      set:    { rate: sql`excluded.rate` },
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
