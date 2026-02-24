import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { assetRepository } from "@/lib/repositories/asset.repository";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  // Filtered view: active + non-expired assets for a specific account
  if (accountId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.accountId, accountId),
          eq(assets.isActive, true),
          or(isNull(assets.expirationDate), gte(assets.expirationDate, today))
        )
      )
      .orderBy(assets.name);

    return NextResponse.json(list);
  }

  const list = await assetRepository.findAll();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, name, type, custodian, currency, country, expirationDate, rule, isActive } =
    await req.json();

  if (!accountId || !name || !type) {
    return NextResponse.json({ error: "accountId, name and type are required." }, { status: 400 });
  }

  const asset = await assetRepository.create({
    accountId,
    name,
    type,
    custodian:      custodian      ?? null,
    currency:       currency       ?? "BRL",
    country:        country        ?? "BR",
    expirationDate: expirationDate ? new Date(expirationDate) : null,
    rule:           rule           ?? null,
    isActive:       isActive       ?? true,
  });

  return NextResponse.json(asset, { status: 201 });
}
