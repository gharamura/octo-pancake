import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accountBalances,
  financialAccounts,
  type AccountBalance,
  type NewAccountBalance,
} from "@/lib/db/schema";

export type AccountBalanceRow = {
  id: string;
  accountId: string;
  date: Date | string;
  balance: string;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  accountName: string | null;
};

export class BalanceRepository {
  private get selectFields() {
    return {
      id:          accountBalances.id,
      accountId:   accountBalances.accountId,
      date:        accountBalances.date,
      balance:     accountBalances.balance,
      notes:       accountBalances.notes,
      createdAt:   accountBalances.createdAt,
      updatedAt:   accountBalances.updatedAt,
      accountName: financialAccounts.name,
    };
  }

  async findAll(filters?: {
    from?:       Date;
    to?:         Date;
    accountIds?: string[];
  }): Promise<AccountBalanceRow[]> {
    const conditions = [isNull(accountBalances.assetId)];
    if (filters?.from)             conditions.push(gte(accountBalances.date, filters.from));
    if (filters?.to)               conditions.push(lte(accountBalances.date, filters.to));
    if (filters?.accountIds?.length) conditions.push(inArray(accountBalances.accountId, filters.accountIds));

    return db
      .select(this.selectFields)
      .from(accountBalances)
      .leftJoin(financialAccounts, eq(accountBalances.accountId, financialAccounts.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(accountBalances.date), desc(accountBalances.createdAt));
  }

  async findById(id: string): Promise<AccountBalanceRow | null> {
    const rows = await db
      .select(this.selectFields)
      .from(accountBalances)
      .leftJoin(financialAccounts, eq(accountBalances.accountId, financialAccounts.id))
      .where(eq(accountBalances.id, id));
    return rows[0] ?? null;
  }

  async create(data: NewAccountBalance): Promise<AccountBalance> {
    const [row] = await db.insert(accountBalances).values(data).returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Omit<AccountBalance, "id" | "createdAt" | "updatedAt">>
  ): Promise<AccountBalance | null> {
    const [row] = await db
      .update(accountBalances)
      .set(data)
      .where(eq(accountBalances.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(accountBalances)
      .where(eq(accountBalances.id, id))
      .returning({ id: accountBalances.id });
    return result.length > 0;
  }
}

export const balanceRepository = new BalanceRepository();
