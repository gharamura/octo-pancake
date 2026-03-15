import { aliasedTable, and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  financialAccounts,
  coaAccounts,
  recipients,
  recipientAliases,
  assets,
  type Transaction,
  type NewTransaction,
} from "@/lib/db/schema";

// Alias the recipients table so we can join it twice:
// once for the direct recipientId link, once for the alias match.
const aliasRecipient = aliasedTable(recipients, "alias_recipient");

export type TransactionRow = {
  id: string;
  transactionDate: Date | string;
  accountingDate: Date | string | null;
  accountId: string;
  coaCode: string | null;
  amount: string;
  currency: string;
  recipient: string | null;
  notes: string | null;
  transferId: string | null;
  recipientId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  accountName: string | null;
  coaName: string | null;
  /** Name of the recipient directly linked via recipientId. */
  linkedRecipientName: string | null;
  /** Recipient ID resolved via alias matching on the raw recipient string. */
  aliasRecipientId: string | null;
  /** Name of the recipient resolved via alias matching. */
  aliasRecipientName: string | null;
  assetId:   string | null;
  assetName: string | null;
};

export class TransactionRepository {
  private get selectFields() {
    return {
      id:                  transactions.id,
      transactionDate:     transactions.transactionDate,
      accountingDate:      transactions.accountingDate,
      accountId:           transactions.accountId,
      coaCode:             transactions.coaCode,
      amount:              transactions.amount,
      currency:            transactions.currency,
      recipient:           transactions.recipient,
      notes:               transactions.notes,
      transferId:          transactions.transferId,
      recipientId:         transactions.recipientId,
      createdAt:           transactions.createdAt,
      updatedAt:           transactions.updatedAt,
      accountName:         financialAccounts.name,
      coaName:             coaAccounts.name,
      linkedRecipientName: recipients.name,
      aliasRecipientId:    recipientAliases.recipientId,
      aliasRecipientName:  aliasRecipient.name,
      assetId:             transactions.assetId,
      assetName:           assets.name,
    };
  }

  async findAll(opts?: { from?: Date; to?: Date }): Promise<TransactionRow[]> {
    const conditions = [
      ...(opts?.from ? [gte(transactions.transactionDate, opts.from)] : []),
      ...(opts?.to   ? [lte(transactions.transactionDate, opts.to)]   : []),
    ];

    return db
      .select(this.selectFields)
      .from(transactions)
      .leftJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
      .leftJoin(coaAccounts, eq(transactions.coaCode, coaAccounts.code))
      .leftJoin(recipients, eq(transactions.recipientId, recipients.id))
      .leftJoin(recipientAliases, eq(transactions.recipient, recipientAliases.alias))
      .leftJoin(aliasRecipient, eq(recipientAliases.recipientId, aliasRecipient.id))
      .leftJoin(assets, eq(transactions.assetId, assets.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));
  }

  async findById(id: string): Promise<TransactionRow | null> {
    const rows = await db
      .select(this.selectFields)
      .from(transactions)
      .leftJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
      .leftJoin(coaAccounts, eq(transactions.coaCode, coaAccounts.code))
      .leftJoin(recipients, eq(transactions.recipientId, recipients.id))
      .leftJoin(recipientAliases, eq(transactions.recipient, recipientAliases.alias))
      .leftJoin(aliasRecipient, eq(recipientAliases.recipientId, aliasRecipient.id))
      .leftJoin(assets, eq(transactions.assetId, assets.id))
      .where(eq(transactions.id, id));
    return rows[0] ?? null;
  }

  async create(data: NewTransaction): Promise<Transaction> {
    const [row] = await db
      .insert(transactions)
      .values({ ...data, recipient: data.recipient?.toUpperCase() ?? null })
      .returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>
  ): Promise<Transaction | null> {
    const [row] = await db
      .update(transactions)
      .set({ ...data, recipient: data.recipient?.toUpperCase() ?? data.recipient })
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

  /** Update coaCode and/or accountingDate on multiple transactions at once. */
  async bulkUpdate(
    ids: string[],
    data: { coaCode?: string | null; accountingDate?: Date | null }
  ): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(transactions)
      .set(data)
      .where(inArray(transactions.id, ids));
  }

  /** Link two transfer legs together by stamping them with a shared transferId. */
  async linkTransactions(id1: string, id2: string): Promise<string> {
    const transferId = crypto.randomUUID();
    await db
      .update(transactions)
      .set({ transferId })
      .where(inArray(transactions.id, [id1, id2]));
    return transferId;
  }

  /** Unlink both legs of a transfer (set transferId → null). */
  async unlinkTransfer(transferId: string): Promise<void> {
    await db
      .update(transactions)
      .set({ transferId: null })
      .where(eq(transactions.transferId, transferId));
  }
}

export const transactionRepository = new TransactionRepository();
