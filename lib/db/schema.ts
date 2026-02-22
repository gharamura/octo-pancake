import { AnyPgColumn, boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ---------------------------------------------------------------------------
// Chart of Accounts
// Global shared table — no userId. code is the natural PK.
// ---------------------------------------------------------------------------

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export const coaAccounts = pgTable(
  "coa_accounts",
  {
    code: text("code").primaryKey(),
    parentCode: text("parent_code").references(
      (): AnyPgColumn => coaAccounts.code,
      { onDelete: "restrict" }
    ),
    name: text("name").notNull(),
    type: text("type").$type<AccountType>().notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("coa_accounts_parent_code_idx").on(t.parentCode),
    index("coa_accounts_type_idx").on(t.type),
  ]
);

export type CoaAccount = typeof coaAccounts.$inferSelect;
export type NewCoaAccount = typeof coaAccounts.$inferInsert;
