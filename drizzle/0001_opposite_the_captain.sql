CREATE TABLE "coa_accounts" (
	"code" text PRIMARY KEY NOT NULL,
	"parent_code" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coa_accounts" ADD CONSTRAINT "coa_accounts_parent_code_coa_accounts_code_fk" FOREIGN KEY ("parent_code") REFERENCES "public"."coa_accounts"("code") ON DELETE restrict ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE INDEX "coa_accounts_parent_code_idx" ON "coa_accounts" USING btree ("parent_code");--> statement-breakpoint
CREATE INDEX "coa_accounts_type_idx" ON "coa_accounts" USING btree ("type");