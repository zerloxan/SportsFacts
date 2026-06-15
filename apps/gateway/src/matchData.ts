import { readFile } from "node:fs/promises";
import {
  GameEventSchema,
  type GameEvent,
  type TeamRef,
} from "@sportsfacts/shared-types";
import { z } from "zod";

/**
 * Types and loader for the normalized match artifact produced by
 * `scripts/normalize-match.ts`. This file-based artifact is the stand-in for
 * the future Postgres stats DB: the fact engine queries `history` for evidence
 * exactly as it will later query SQL.
 */

export const MatchMetaSchema = z.object({
  matchId: z.string(),
  competition: z.string(),
  stage: z.string(),
  date: z.string(),
  stadium: z.string().optional(),
  home: z.object({ id: z.number(), name: z.string() }),
  away: z.object({ id: z.number(), name: z.string() }),
  finalScore: z.object({ home: z.number(), away: z.number() }),
  wentToPenalties: z.boolean(),
  shootoutScore: z
    .object({ home: z.number(), away: z.number() })
    .nullable()
    .default(null),
});
export type MatchMeta = z.infer<typeof MatchMetaSchema>;

/** A pre-existing record the fact engine can cite as evidence. */
export const CuratedRecordSchema = z.object({
  id: z.string(),
  kind: z.string(),
  text: z.string(),
  data: z.record(z.unknown()),
});
export type CuratedRecord = z.infer<typeof CuratedRecordSchema>;

export const HistorySchema = z.object({
  /** Player tournament goals scored BEFORE this match. */
  preMatchTournamentGoals: z.record(
    z.object({ name: z.string(), goals: z.number() }),
  ),
  /** Display nicknames keyed by player id. */
  nicknames: z.record(z.string()),
  /** Curated cross-match records. */
  records: z.array(CuratedRecordSchema),
});
export type History = z.infer<typeof HistorySchema>;

export const NormalizedMatchSchema = z.object({
  meta: MatchMetaSchema,
  events: z.array(z.unknown()),
  history: HistorySchema,
});

export interface NormalizedMatch {
  meta: MatchMeta;
  events: GameEvent[];
  history: History;
}

/** Load + validate the normalized artifact. Throws on malformed data. */
export async function loadNormalizedMatch(
  path: string,
): Promise<NormalizedMatch> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  const parsed = NormalizedMatchSchema.parse(raw);
  // Validate every event against the canonical contract (spec: 1.3).
  const events = parsed.events.map((e) => GameEventSchema.parse(e));
  return { meta: parsed.meta, events, history: parsed.history };
}

export function homeAwayOf(
  meta: MatchMeta,
  team: TeamRef,
): "home" | "away" | null {
  if (team.id === meta.home.id) return "home";
  if (team.id === meta.away.id) return "away";
  return null;
}
