import { db } from "@/lib/db";
import { assets, financialAccounts, type Asset, type NewAsset } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type AssetWithAccount = Asset & { accountName: string | null };

export class AssetRepository {
  async findAll(): Promise<AssetWithAccount[]> {
    return db
      .select({
        id:             assets.id,
        accountId:      assets.accountId,
        name:           assets.name,
        assetClass:     assets.assetClass,
        geography:      assets.geography,
        riskFactor:     assets.riskFactor,
        liquidity:      assets.liquidity,
        custodian:      assets.custodian,
        currency:       assets.currency,
        expirationDate: assets.expirationDate,
        rule:           assets.rule,
        isActive:       assets.isActive,
        createdAt:      assets.createdAt,
        updatedAt:      assets.updatedAt,
        accountName:    financialAccounts.name,
      })
      .from(assets)
      .leftJoin(financialAccounts, eq(financialAccounts.id, assets.accountId))
      .orderBy(assets.name);
  }

  async findById(id: string): Promise<Asset | null> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return asset ?? null;
  }

  async create(data: NewAsset): Promise<Asset> {
    const [asset] = await db.insert(assets).values(data).returning();
    return asset;
  }

  async update(
    id: string,
    data: Partial<Pick<Asset,
      | "accountId" | "name" | "assetClass" | "geography" | "riskFactor" | "liquidity"
      | "custodian" | "currency" | "expirationDate" | "rule" | "isActive"
    >>
  ): Promise<Asset | null> {
    const [asset] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return asset ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(assets).where(eq(assets.id, id)).returning({ id: assets.id });
    return result.length > 0;
  }
}

export const assetRepository = new AssetRepository();
