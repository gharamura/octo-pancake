CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_date" date NOT NULL,
	"accounting_date" date,
	"account_id" text NOT NULL,
	"coa_code" text,
	"amount" numeric(15, 2) NOT NULL,
	"recipient" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_coa_code_idx" ON "transactions" USING btree ("coa_code");--> statement-breakpoint
CREATE INDEX "transactions_transaction_date_idx" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_accounting_date_idx" ON "transactions" USING btree ("accounting_date");