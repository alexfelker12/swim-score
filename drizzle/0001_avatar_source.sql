ALTER TABLE "avatar" ADD COLUMN "source_content_type" text;--> statement-breakpoint
ALTER TABLE "avatar" ADD COLUMN "source" "bytea";--> statement-breakpoint
ALTER TABLE "avatar" ADD COLUMN "crop" jsonb;