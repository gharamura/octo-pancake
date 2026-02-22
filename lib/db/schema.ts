import { AnyPgColumn, boolean, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Financial Accounts
// Global shared table — no userId.
// ---------------------------------------------------------------------------

export type FinancialAccountType = "savings" | "checking" | "credit_card" | "investment" | "benefits" | "other";

export const financialAccounts = pgTable("financial_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").$type<FinancialAccountType>().notNull(),
  institution: text("institution"),
  owner: text("owner"),
  accountNumber: text("account_number"),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type NewFinancialAccount = typeof financialAccounts.$inferInsert;

// ---------------------------------------------------------------------------
// Transactions
// Global shared table — no userId.
// accountId and coaCode are soft references (indexes only, no FK constraints).
// ---------------------------------------------------------------------------

export const transactions = pgTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transactionDate: date("transaction_date", { mode: "date" }).notNull(),
    accountingDate:  date("accounting_date",  { mode: "date" }),
    accountId:       text("account_id").notNull(),
    coaCode:         text("coa_code"),
    amount:          numeric("amount", { precision: 15, scale: 2 }).notNull(),
    recipient:       text("recipient"),
    notes:           text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("transactions_account_id_idx").on(t.accountId),
    index("transactions_coa_code_idx").on(t.coaCode),
    index("transactions_transaction_date_idx").on(t.transactionDate),
    index("transactions_accounting_date_idx").on(t.accountingDate),
  ]
);

export type Transaction    = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// ---------------------------------------------------------------------------
// Account Balances
// Manual balance snapshots per account.
// accountId is a soft reference (index only, no FK constraint).
// ---------------------------------------------------------------------------

export const accountBalances = pgTable(
  "account_balances",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id").notNull(),
    date:      date("date", { mode: "date" }).notNull(),
    balance:   numeric("balance", { precision: 15, scale: 2 }).notNull(),
    notes:     text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("account_balances_account_id_idx").on(t.accountId),
    index("account_balances_date_idx").on(t.date),
  ]
);

export type AccountBalance    = typeof accountBalances.$inferSelect;
export type NewAccountBalance = typeof accountBalances.$inferInsert;

// ---------------------------------------------------------------------------
// Recipients
// Internal FKs: aliases and coa_links reference recipients (cascade delete).
// coaCode is a soft reference (cross-domain, index only, no FK).
// ---------------------------------------------------------------------------

export const recipients = pgTable("recipients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name:     text("name").notNull(),
  notes:    text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Recipient    = typeof recipients.$inferSelect;
export type NewRecipient = typeof recipients.$inferInsert;

export const recipientAliases = pgTable(
  "recipient_aliases",
  {
    alias:       text("alias").primaryKey(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => recipients.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("recipient_aliases_recipient_id_idx").on(t.recipientId),
  ]
);

export type RecipientAlias    = typeof recipientAliases.$inferSelect;
export type NewRecipientAlias = typeof recipientAliases.$inferInsert;

export const recipientCoa = pgTable(
  "recipient_coa",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => recipients.id, { onDelete: "cascade" }),
    coaCode:   text("coa_code").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("recipient_coa_unique_idx").on(t.recipientId, t.coaCode),
    index("recipient_coa_coa_code_idx").on(t.coaCode),
  ]
);

export type RecipientCoa    = typeof recipientCoa.$inferSelect;
export type NewRecipientCoa = typeof recipientCoa.$inferInsert;
