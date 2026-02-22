import { db } from "@/lib/db";
import { financialAccounts, type FinancialAccount, type NewFinancialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class AccountRepository {
  async findAll(): Promise<FinancialAccount[]> {
    return db.select().from(financialAccounts).orderBy(financialAccounts.name);
  }

  async findById(id: string): Promise<FinancialAccount | null> {
    const [account] = await db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.id, id))
      .limit(1);
    return account ?? null;
  }

  async create(data: NewFinancialAccount): Promise<FinancialAccount> {
    const [account] = await db.insert(financialAccounts).values(data).returning();
    return account;
  }

  async update(
    id: string,
    data: Partial<Pick<FinancialAccount, "name" | "type" | "institution" | "owner" | "accountNumber" | "openingBalance" | "notes" | "isActive">>
  ): Promise<FinancialAccount | null> {
    const [account] = await db
      .update(financialAccounts)
      .set(data)
      .where(eq(financialAccounts.id, id))
      .returning();
    return account ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(financialAccounts)
      .where(eq(financialAccounts.id, id))
      .returning({ id: financialAccounts.id });
    return result.length > 0;
  }
}

export const accountRepository = new AccountRepository();
