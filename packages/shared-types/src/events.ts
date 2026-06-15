import { z } from "zod";

/**
 * Canonical, normalized game-event contract.
 *
 * The replay engine produces these from raw StatsBomb match JSON; the gateway
 * and the AI service consume them. This Zod schema is the single source of
 * truth — every service validates at its boundary and derives its static type
 * from here via {@link GameEvent}.
 */

export const TeamRefSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
});
export type TeamRef = z.infer<typeof TeamRefSchema>;

export const PlayerRefSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
});
export type PlayerRef = z.infer<typeof PlayerRefSchema>;

/** Event types we model explicitly; everything else maps to `other`. */
export const GameEventTypeSchema = z.enum([
  "kickoff",
  "pass",
  "shot",
  "goal",
  "card",
  "substitution",
  "foul",
  "corner",
  "half_end",
  "full_time",
  "other",
]);
export type GameEventType = z.infer<typeof GameEventTypeSchema>;

/** Fields shared by every normalized event. */
const baseEventShape = {
  /** Stable unique id for this event (uuid). */
  id: z.string().uuid(),
  /** Match this event belongs to. */
  matchId: z.string().min(1),
  /** Monotonic ordering index within the match. */
  sequence: z.number().int().nonnegative(),
  /** Match clock. */
  period: z.number().int().positive(),
  minute: z.number().int().nonnegative(),
  second: z.number().int().min(0).max(59),
  /** Wall-clock offset (ms from match start) used by the replay timeline. */
  timelineOffsetMs: z.number().int().nonnegative(),
  team: TeamRefSchema,
  player: PlayerRefSchema.optional(),
};

export const ShotEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("shot"),
  details: z.object({
    xg: z.number().min(0).max(1).optional(),
    outcome: z.string().min(1),
    onTarget: z.boolean().default(false),
  }),
});

export const GoalEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("goal"),
  details: z.object({
    xg: z.number().min(0).max(1).optional(),
    assistPlayer: PlayerRefSchema.optional(),
    scoreAfter: z.object({ home: z.number().int(), away: z.number().int() }),
    /** Scored from a penalty kick (in open play / ET, not the shootout). */
    penalty: z.boolean().optional(),
    /** True when this goal is a penalty-shootout kick. */
    shootout: z.boolean().optional(),
    /** Running shootout tally, present only for shootout kicks. */
    shootoutAfter: z
      .object({ home: z.number().int(), away: z.number().int() })
      .optional(),
  }),
});

export const CardEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("card"),
  details: z.object({
    card: z.enum(["yellow", "second_yellow", "red"]),
    reason: z.string().optional(),
  }),
});

export const SubstitutionEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("substitution"),
  details: z.object({
    playerOff: PlayerRefSchema,
    playerOn: PlayerRefSchema,
  }),
});

/** Catch-all for event types we don't model explicitly yet. */
export const GenericEventSchema = z.object({
  ...baseEventShape,
  type: z.enum([
    "kickoff",
    "pass",
    "foul",
    "corner",
    "half_end",
    "full_time",
    "other",
  ]),
  details: z.record(z.unknown()).default({}),
});

export const GameEventSchema = z.discriminatedUnion("type", [
  ShotEventSchema,
  GoalEventSchema,
  CardEventSchema,
  SubstitutionEventSchema,
  GenericEventSchema,
]);
export type GameEvent = z.infer<typeof GameEventSchema>;

/** Parse-or-throw helper for service boundaries. */
export function parseGameEvent(input: unknown): GameEvent {
  return GameEventSchema.parse(input);
}
