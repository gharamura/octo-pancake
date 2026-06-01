import { db } from "@/lib/db";
import { recurringTransactions, type RecurringTransaction, type NewRecurringTransaction } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export class RecurringRepository {
  async findAll(): Promise<RecurringTransaction[]> {
    return db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.isActive, true))
      .orderBy(recurringTransactions.dayOfMonth, recurringTransactions.name);
  }

  async findById(id: string): Promise<RecurringTransaction | null> {
    const [row] = await db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.id, id))
      .limit(1);
    return row ?? null;
  }

  async create(data: NewRecurringTransaction): Promise<RecurringTransaction> {
    const [row] = await db.insert(recurringTransactions).values(data).returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Pick<RecurringTransaction,
      | "name" | "amount" | "type" | "accountId" | "coaCode"
      | "recipientId" | "dayOfMonth" | "currency" | "isActive" | "notes"
    >>
  ): Promise<RecurringTransaction | null> {
    const [row] = await db
      .update(recurringTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recurringTransactions.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(recurringTransactions)
      .where(eq(recurringTransactions.id, id))
      .returning({ id: recurringTransactions.id });
    return result.length > 0;
  }
}

export const recurringRepository = new RecurringRepository();
