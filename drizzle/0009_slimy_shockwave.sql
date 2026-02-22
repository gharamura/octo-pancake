ALTER TABLE "transactions" ADD COLUMN "recipient_id" text;--> statement-breakpoint
CREATE INDEX "transactions_recipient_id_idx" ON "transactions" USING btree ("recipient_id");