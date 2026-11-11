ALTER TABLE "game" ADD COLUMN "spectator_token" text;--> statement-breakpoint
-- Games from before Spectator links existed get a random token each.
UPDATE "game" SET "spectator_token" = replace(gen_random_uuid()::text, '-', '');--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "spectator_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_spectator_token_unique" UNIQUE("spectator_token");
