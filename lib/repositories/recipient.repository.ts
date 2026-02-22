import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  recipients,
  recipientAliases,
  recipientCoa,
  coaAccounts,
  type Recipient,
  type NewRecipient,
  type RecipientAlias,
  type RecipientCoa,
} from "@/lib/db/schema";

export type RecipientCoaRow = RecipientCoa & { coaName: string | null };

export type RecipientDetail = Recipient & {
  aliases: RecipientAlias[];
  coas:    RecipientCoaRow[];
};

const coaFields = {
  id:          recipientCoa.id,
  recipientId: recipientCoa.recipientId,
  coaCode:     recipientCoa.coaCode,
  isPrimary:   recipientCoa.isPrimary,
  createdAt:   recipientCoa.createdAt,
  coaName:     coaAccounts.name,
} as const;

export class RecipientRepository {
  async findAll(): Promise<RecipientDetail[]> {
    const recs = await db
      .select()
      .from(recipients)
      .orderBy(recipients.name);

    if (recs.length === 0) return [];

    const ids = recs.map((r) => r.id);

    const [aliases, coas] = await Promise.all([
      db.select()
        .from(recipientAliases)
        .where(inArray(recipientAliases.recipientId, ids))
        .orderBy(recipientAliases.alias),
      db.select(coaFields)
        .from(recipientCoa)
        .leftJoin(coaAccounts, eq(recipientCoa.coaCode, coaAccounts.code))
        .where(inArray(recipientCoa.recipientId, ids)),
    ]);

    const aliasMap = new Map<string, RecipientAlias[]>();
    const coaMap   = new Map<string, RecipientCoaRow[]>();

    for (const a of aliases) {
      const list = aliasMap.get(a.recipientId) ?? [];
      list.push(a);
      aliasMap.set(a.recipientId, list);
    }
    for (const c of coas) {
      const list = coaMap.get(c.recipientId) ?? [];
      list.push(c);
      coaMap.set(c.recipientId, list);
    }

    return recs.map((r) => ({
      ...r,
      aliases: aliasMap.get(r.id) ?? [],
      coas:    coaMap.get(r.id)   ?? [],
    }));
  }

  async findById(id: string): Promise<RecipientDetail | null> {
    const [rec] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.id, id));

    if (!rec) return null;

    const [aliases, coas] = await Promise.all([
      db.select()
        .from(recipientAliases)
        .where(eq(recipientAliases.recipientId, id))
        .orderBy(recipientAliases.alias),
      db.select(coaFields)
        .from(recipientCoa)
        .leftJoin(coaAccounts, eq(recipientCoa.coaCode, coaAccounts.code))
        .where(eq(recipientCoa.recipientId, id)),
    ]);

    return { ...rec, aliases, coas };
  }

  async create(data: NewRecipient): Promise<Recipient> {
    const [row] = await db.insert(recipients).values(data).returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Omit<Recipient, "id" | "createdAt" | "updatedAt">>
  ): Promise<Recipient | null> {
    const [row] = await db
      .update(recipients)
      .set(data)
      .where(eq(recipients.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(recipients)
      .where(eq(recipients.id, id))
      .returning({ id: recipients.id });
    return result.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Aliases
  // ---------------------------------------------------------------------------

  async addAlias(alias: string, recipientId: string): Promise<RecipientAlias> {
    const [row] = await db
      .insert(recipientAliases)
      .values({ alias: alias.toUpperCase(), recipientId })
      .returning();
    return row;
  }

  async removeAlias(alias: string): Promise<boolean> {
    const result = await db
      .delete(recipientAliases)
      .where(eq(recipientAliases.alias, alias.toUpperCase()))
      .returning({ alias: recipientAliases.alias });
    return result.length > 0;
  }

  // ---------------------------------------------------------------------------
  // COA links
  // ---------------------------------------------------------------------------

  async addCoa(
    recipientId: string,
    coaCode: string,
    isPrimary: boolean
  ): Promise<RecipientCoa> {
    if (isPrimary) {
      await this.clearPrimary(recipientId);
    }
    const [row] = await db
      .insert(recipientCoa)
      .values({ recipientId, coaCode, isPrimary })
      .returning();
    return row;
  }

  async setPrimary(coaLinkId: string, recipientId: string): Promise<RecipientCoa | null> {
    await this.clearPrimary(recipientId);
    const [row] = await db
      .update(recipientCoa)
      .set({ isPrimary: true })
      .where(eq(recipientCoa.id, coaLinkId))
      .returning();
    return row ?? null;
  }

  async removeCoa(coaLinkId: string): Promise<boolean> {
    const result = await db
      .delete(recipientCoa)
      .where(eq(recipientCoa.id, coaLinkId))
      .returning({ id: recipientCoa.id });
    return result.length > 0;
  }

  private async clearPrimary(recipientId: string): Promise<void> {
    await db
      .update(recipientCoa)
      .set({ isPrimary: false })
      .where(
        and(
          eq(recipientCoa.recipientId, recipientId),
          eq(recipientCoa.isPrimary, true)
        )
      );
  }
}

export const recipientRepository = new RecipientRepository();
