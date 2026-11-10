CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"rule_set" jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"scorekeeper_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "game_event" (
	"game_id" text NOT NULL,
	"version" integer NOT NULL,
	"event" jsonb NOT NULL,
	"recorded_by_id" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_event_game_id_version_pk" PRIMARY KEY("game_id","version")
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"player_id" text NOT NULL,
	"seat" integer NOT NULL,
	"won" boolean,
	"swam" boolean,
	"bombs" integer,
	"lives_lost" integer,
	"out_position" integer
);
--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_scorekeeper_id_user_id_fk" FOREIGN KEY ("scorekeeper_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_group_id_idx" ON "game" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_game_seat_idx" ON "participant" USING btree ("game_id","seat");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_game_player_idx" ON "participant" USING btree ("game_id","player_id");