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
  const accountId  = searchParams.get("accountId");
  const includeAll = searchParams.get("includeAll") === "true";

  // Filtered view: assets for a specific account
  if (accountId) {
    const where = includeAll
      ? eq(assets.accountId, accountId)
      : (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return and(
            eq(assets.accountId, accountId),
            eq(assets.isActive, true),
            or(isNull(assets.expirationDate), gte(assets.expirationDate, today))
          );
        })();

    const list = await db
      .select()
      .from(assets)
      .where(where)
      .orderBy(assets.name);

    return NextResponse.json(list);
  }

  const list = await assetRepository.findAll();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, name, assetClass, geography, riskFactor, liquidity, custodian, currency, expirationDate, rule, isActive } =
    await req.json();

  if (!accountId || !name) {
    return NextResponse.json({ error: "accountId and name are required." }, { status: 400 });
  }

  const asset = await assetRepository.create({
    accountId,
    name,
    assetClass:     assetClass     ?? null,
    geography:      geography      ?? null,
    riskFactor:     riskFactor     ?? null,
    liquidity:      liquidity      ?? null,
    custodian:      custodian      ?? null,
    currency:       currency       ?? "BRL",
    expirationDate: expirationDate ? new Date(expirationDate) : null,
    rule:           rule           ?? null,
    isActive:       isActive       ?? true,
  });

  return NextResponse.json(asset, { status: 201 });
}
