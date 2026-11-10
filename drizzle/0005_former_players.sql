ALTER TABLE "game" DROP CONSTRAINT "game_scorekeeper_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "group" DROP CONSTRAINT "group_admin_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "scorekeeper_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "left_at" timestamp;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "left_reason" text;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "former_number" integer;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_scorekeeper_id_user_id_fk" FOREIGN KEY ("scorekeeper_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;