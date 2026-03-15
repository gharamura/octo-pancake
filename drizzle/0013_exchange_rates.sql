CREATE TABLE "exchange_rates" (
  "id" text PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "from_currency" text NOT NULL,
  "to_currency" text NOT NULL DEFAULT 'BRL',
  "rate" numeric(20, 6) NOT NULL,
  "date" date NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_currency_date_idx" ON "exchange_rates" USING btree ("from_currency","to_currency","date");
--> statement-breakpoint
CREATE INDEX "exchange_rates_date_idx" ON "exchange_rates" USING btree ("date");
