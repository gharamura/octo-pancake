CREATE TABLE "financial_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"institution" text,
	"owner" text,
	"account_number" text,
	"opening_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
