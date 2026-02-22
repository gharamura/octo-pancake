CREATE TABLE "recipient_aliases" (
	"alias" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient_coa" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"coa_code" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipient_aliases" ADD CONSTRAINT "recipient_aliases_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_coa" ADD CONSTRAINT "recipient_coa_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipient_aliases_recipient_id_idx" ON "recipient_aliases" USING btree ("recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipient_coa_unique_idx" ON "recipient_coa" USING btree ("recipient_id","coa_code");--> statement-breakpoint
CREATE INDEX "recipient_coa_coa_code_idx" ON "recipient_coa" USING btree ("coa_code");