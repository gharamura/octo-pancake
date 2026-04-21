import { auth } from "@/auth";
import { assetRepository } from "@/lib/repositories/asset.repository";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { accountId, name, assetClass, geography, riskFactor, liquidity, custodian, currency, expirationDate, index, rule, isActive } =
    await req.json();

  if (!accountId || !name) {
    return NextResponse.json({ error: "accountId and name are required." }, { status: 400 });
  }

  const asset = await assetRepository.update(id, {
    accountId,
    name,
    assetClass:     assetClass     ?? null,
    geography:      geography      ?? null,
    riskFactor:     riskFactor     ?? null,
    liquidity:      liquidity      ?? null,
    custodian:      custodian      ?? null,
    currency:       currency       ?? "BRL",
    expirationDate: expirationDate ? new Date(expirationDate) : null,
    index:          index          ?? null,
    rule:           rule           ?? null,
    isActive,
  });

  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  return NextResponse.json(asset);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await assetRepository.delete(id);

  if (!deleted) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
