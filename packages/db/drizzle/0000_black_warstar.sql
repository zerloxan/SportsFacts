CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"statsbomb_event_id" text NOT NULL,
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"team_name" text NOT NULL,
	"minute" integer NOT NULL,
	"period" integer NOT NULL,
	"penalty" boolean DEFAULT false NOT NULL,
	"shootout" boolean DEFAULT false NOT NULL,
	CONSTRAINT "goals_statsbomb_event_id_unique" UNIQUE("statsbomb_event_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"match_id" integer PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"competition_name" text NOT NULL,
	"season_name" text NOT NULL,
	"stage" text,
	"match_date" date NOT NULL,
	"home_team_id" integer NOT NULL,
	"home_team_name" text NOT NULL,
	"away_team_id" integer NOT NULL,
	"away_team_name" text NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"player_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_match_id_matches_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("match_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_player_id_players_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_player_idx" ON "goals" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "goals_match_idx" ON "goals" USING btree ("match_id");