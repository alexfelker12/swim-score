CREATE TABLE "claim" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"player_id" text NOT NULL,
	"guest_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claim_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "invite_token" text;--> statement-breakpoint
-- Groups from before Invites existed get a random token each.
UPDATE "group" SET "invite_token" = replace(gen_random_uuid()::text, '-', '');--> statement-breakpoint
ALTER TABLE "group" ALTER COLUMN "invite_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_guest_id_player_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_group_id_idx" ON "claim" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_invite_token_unique" UNIQUE("invite_token");