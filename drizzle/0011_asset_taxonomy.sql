-- Rename type → asset_class and country → geography
ALTER TABLE "assets" RENAME COLUMN "type" TO "asset_class";
--> statement-breakpoint
ALTER TABLE "assets" RENAME COLUMN "country" TO "geography";
--> statement-breakpoint
-- Make both nullable (old values don't match new taxonomy)
ALTER TABLE "assets" ALTER COLUMN "asset_class" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "geography" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "geography" DROP DEFAULT;
--> statement-breakpoint
-- Add new taxonomy columns
ALTER TABLE "assets" ADD COLUMN "risk_factor" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "liquidity" text;
--> statement-breakpoint
-- Re-index
DROP INDEX IF EXISTS "assets_type_idx";
--> statement-breakpoint
CREATE INDEX "assets_asset_class_idx" ON "assets" USING btree ("asset_class");
