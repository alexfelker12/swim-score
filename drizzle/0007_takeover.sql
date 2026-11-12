CREATE TABLE "takeover" (
	"game_id" text NOT NULL,
	"version" integer NOT NULL,
	"after_events" integer NOT NULL,
	"participant_id" text NOT NULL,
	"previous_participant_id" text,
	"previous_offline" boolean NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "takeover_game_id_version_pk" PRIMARY KEY("game_id","version")
);
--> statement-breakpoint
ALTER TABLE "participant" ADD COLUMN "connected" boolean;--> statement-breakpoint
ALTER TABLE "participant" ADD COLUMN "presence_at" timestamp;--> statement-breakpoint
ALTER TABLE "takeover" ADD CONSTRAINT "takeover_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeover" ADD CONSTRAINT "takeover_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeover" ADD CONSTRAINT "takeover_previous_participant_id_participant_id_fk" FOREIGN KEY ("previous_participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;