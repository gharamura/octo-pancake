import { db } from "@/lib/db";
import { coaAccounts, type CoaAccount, type NewCoaAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class CoaRepository {
  async findAll(): Promise<CoaAccount[]> {
    return db.select().from(coaAccounts).orderBy(coaAccounts.code);
  }

  async findByCode(code: string): Promise<CoaAccount | null> {
    const [account] = await db
      .select()
      .from(coaAccounts)
      .where(eq(coaAccounts.code, code))
      .limit(1);
    return account ?? null;
  }

  async create(data: NewCoaAccount): Promise<CoaAccount> {
    const [account] = await db.insert(coaAccounts).values(data).returning();
    return account;
  }

  async update(
    code: string,
    data: Partial<Pick<CoaAccount, "name" | "parentCode" | "type" | "description" | "isActive">>
  ): Promise<CoaAccount | null> {
    const [account] = await db
      .update(coaAccounts)
      .set(data)
      .where(eq(coaAccounts.code, code))
      .returning();
    return account ?? null;
  }

  async delete(code: string): Promise<boolean> {
    const result = await db
      .delete(coaAccounts)
      .where(eq(coaAccounts.code, code))
      .returning({ code: coaAccounts.code });
    return result.length > 0;
  }
}

export const coaRepository = new CoaRepository();
