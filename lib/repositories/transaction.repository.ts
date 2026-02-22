import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  financialAccounts,
  coaAccounts,
  type Transaction,
  type NewTransaction,
} from "@/lib/db/schema";

export type TransactionRow = {
  id: string;
  transactionDate: Date | string;
  accountingDate: Date | string | null;
  accountId: string;
  coaCode: string | null;
  amount: string;
  recipient: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  accountName: string | null;
  coaName: string | null;
};

export class TransactionRepository {
  private get selectFields() {
    return {
      id:              transactions.id,
      transactionDate: transactions.transactionDate,
      accountingDate:  transactions.accountingDate,
      accountId:       transactions.accountId,
      coaCode:         transactions.coaCode,
      amount:          transactions.amount,
      recipient:       transactions.recipient,
      notes:           transactions.notes,
      createdAt:       transactions.createdAt,
      updatedAt:       transactions.updatedAt,
      accountName:     financialAccounts.name,
      coaName:         coaAccounts.name,
    };
  }

  async findAll(): Promise<TransactionRow[]> {
    return db
      .select(this.selectFields)
      .from(transactions)
      .leftJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
      .leftJoin(coaAccounts, eq(transactions.coaCode, coaAccounts.code))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));
  }

  async findById(id: string): Promise<TransactionRow | null> {
    const rows = await db
      .select(this.selectFields)
      .from(transactions)
      .leftJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
      .leftJoin(coaAccounts, eq(transactions.coaCode, coaAccounts.code))
      .where(eq(transactions.id, id));
    return rows[0] ?? null;
  }

  async create(data: NewTransaction): Promise<Transaction> {
    const [row] = await db.insert(transactions).values(data).returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>
  ): Promise<Transaction | null> {
    const [row] = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id });
    return result.length > 0;
  }
}

export const transactionRepository = new TransactionRepository();
