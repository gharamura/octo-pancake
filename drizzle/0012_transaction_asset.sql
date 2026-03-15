ALTER TABLE "transactions" ADD COLUMN "asset_id" text;
--> statement-breakpoint
CREATE INDEX "transactions_asset_id_idx" ON "transactions" USING btree ("asset_id");
