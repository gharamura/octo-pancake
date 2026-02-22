CREATE TABLE "account_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"date" date NOT NULL,
	"balance" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_balances_account_id_idx" ON "account_balances" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_balances_date_idx" ON "account_balances" USING btree ("date");