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

export type AccountType = "income" | "expense" | "transfer" | "investment";

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
  accountNumber:  text("account_number"),
  currency:       text("currency").notNull().default("BRL"),
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
    currency:        text("currency").notNull().default("BRL"),
    recipient:       text("recipient"),
    notes:           text("notes"),
    // Shared UUID between the two legs of a transfer (COA 3110 ↔ 3120).
    // Null means the transaction is not (yet) linked to its counterpart.
    transferId:      text("transfer_id"),
    // Direct link to a known recipient — bypasses alias matching when the
    // raw description string is too generic to serve as a unique alias.
    recipientId:     text("recipient_id"),
    // Link to an asset — required for COA codes 1060, 4110, 4210.
    assetId:         text("asset_id"),
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
    index("transactions_transfer_id_idx").on(t.transferId),
    index("transactions_recipient_id_idx").on(t.recipientId),
    index("transactions_asset_id_idx").on(t.assetId),
  ]
);

export type Transaction    = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// ---------------------------------------------------------------------------
// Account Balances
// Manual balance snapshots — shared by financial accounts and individual assets.
// accountId is a soft reference (index only, no FK constraint).
// assetId is null for account-level snapshots; set for asset-level snapshots.
// ---------------------------------------------------------------------------

export const accountBalances = pgTable(
  "account_balances",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id").notNull(),
    assetId:   text("asset_id"),   // null → account balance | set → asset balance
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
    index("account_balances_asset_id_idx").on(t.assetId),
  ]
);

export type AccountBalance    = typeof accountBalances.$inferSelect;
export type NewAccountBalance = typeof accountBalances.$inferInsert;

// ---------------------------------------------------------------------------
// Assets
// Individual investment positions linked to a financial account.
// accountId is a soft reference (index only, no FK constraint).
// ---------------------------------------------------------------------------

export type AssetClass =
  | "cash_equivalents"
  | "fixed_income"
  | "investment_funds"
  | "structured_products"
  | "variable_income"
  | "crypto"
  | "pension";

export type AssetGeography = "BR" | "US" | "China" | "Global" | "Offshore USD";

export type AssetRiskFactor =
  | "agro"
  | "real_estate"
  | "alternatives"
  | "bank"
  | "corporate"
  | "cash"
  | "crypto"
  | "china"
  | "us"
  | "commodities"
  | "debentures"
  | "etf"
  | "adr"
  | "reit"
  | "gold"
  | "hedge"
  | "stocks"
  | "fixed_income";

// "market" | "lockup" | a numeric string representing days (e.g. "30", "90")
export type AssetLiquidity = string;

export type AssetIndex = "VGBL" | "PGBL" | "CDI" | "Pre" | "IPCA" | "TR";

export const assets = pgTable(
  "assets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId:      text("account_id").notNull(),
    name:           text("name").notNull(),
    assetClass:     text("asset_class").$type<AssetClass>(),
    geography:      text("geography").$type<AssetGeography>(),
    riskFactor:     text("risk_factor").$type<AssetRiskFactor>(),
    liquidity:      text("liquidity").$type<AssetLiquidity>(),
    custodian:      text("custodian"),
    currency:       text("currency").notNull().default("BRL"),
    expirationDate: date("expiration_date", { mode: "date" }),
    index:          text("index").$type<AssetIndex>(),
    rule:           text("rule"),
    isActive:       boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("assets_account_id_idx").on(t.accountId),
    index("assets_asset_class_idx").on(t.assetClass),
  ]
);

export type Asset    = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

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

// ---------------------------------------------------------------------------
// Exchange Rates
// Spot exchange rates (from_currency → to_currency) used for asset valuation.
// Unique per currency pair + date; upsert on conflict.
// ---------------------------------------------------------------------------

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    fromCurrency: text("from_currency").notNull(),
    toCurrency:   text("to_currency").notNull().default("BRL"),
    rate:         numeric("rate", { precision: 20, scale: 6 }).notNull(),
    date:         date("date", { mode: "date" }).notNull(),
    createdAt:    timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("exchange_rates_currency_date_idx").on(t.fromCurrency, t.toCurrency, t.date),
    index("exchange_rates_date_idx").on(t.date),
  ]
);

export type ExchangeRate    = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
