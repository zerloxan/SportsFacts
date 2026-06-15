import {
  pgTable,
  integer,
  text,
  boolean,
  serial,
  date,
  index,
} from "drizzle-orm/pg-core";

/**
 * Lean stats schema backing the agent's verification queries: matches, players,
 * and goals from StatsBomb open data. Only goals (not all events) are stored —
 * that's what the tournament-tally verification needs.
 */

export const matches = pgTable("matches", {
  matchId: integer("match_id").primaryKey(),
  competitionId: integer("competition_id").notNull(),
  seasonId: integer("season_id").notNull(),
  competitionName: text("competition_name").notNull(),
  seasonName: text("season_name").notNull(),
  stage: text("stage"),
  matchDate: date("match_date").notNull(),
  homeTeamId: integer("home_team_id").notNull(),
  homeTeamName: text("home_team_name").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  awayTeamName: text("away_team_name").notNull(),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
});

export const players = pgTable("players", {
  playerId: integer("player_id").primaryKey(),
  name: text("name").notNull(),
});

export const goals = pgTable(
  "goals",
  {
    id: serial("id").primaryKey(),
    /** StatsBomb event uuid — natural key for idempotent upserts. */
    statsbombEventId: text("statsbomb_event_id").notNull().unique(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.matchId),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.playerId),
    teamId: integer("team_id").notNull(),
    teamName: text("team_name").notNull(),
    minute: integer("minute").notNull(),
    period: integer("period").notNull(),
    penalty: boolean("penalty").notNull().default(false),
    shootout: boolean("shootout").notNull().default(false),
  },
  (t) => [
    index("goals_player_idx").on(t.playerId),
    index("goals_match_idx").on(t.matchId),
  ],
);

export type Match = typeof matches.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Goal = typeof goals.$inferSelect;
