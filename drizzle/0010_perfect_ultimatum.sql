CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"custodian" text,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"country" text DEFAULT 'BR' NOT NULL,
	"expiration_date" date,
	"rule" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD COLUMN "asset_id" text;--> statement-breakpoint
CREATE INDEX "assets_account_id_idx" ON "assets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "assets_type_idx" ON "assets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "account_balances_asset_id_idx" ON "account_balances" USING btree ("asset_id");