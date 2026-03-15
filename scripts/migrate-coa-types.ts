/**
 * One-time migration: rename COA account types.
 *   equity    → transfer
 *   asset     → investment
 *   liability → investment
 */
import { db } from "../lib/db";
import { coaAccounts } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const r1 = await db.update(coaAccounts).set({ type: "transfer" }).where(eq(coaAccounts.type, sql`'equity'`));
  const r2 = await db.update(coaAccounts).set({ type: "investment" }).where(eq(coaAccounts.type, sql`'asset'`));
  const r3 = await db.update(coaAccounts).set({ type: "investment" }).where(eq(coaAccounts.type, sql`'liability'`));
  console.log("Migration complete — equity→transfer, asset+liability→investment");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
