ALTER TABLE "transactions" ADD COLUMN "transfer_id" text;--> statement-breakpoint
CREATE INDEX "transactions_transfer_id_idx" ON "transactions" USING btree ("transfer_id");