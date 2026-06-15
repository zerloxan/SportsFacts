import { z } from "zod";

/**
 * Canonical contract for an AI-generated, broadcast-worthy fact.
 *
 * A fact MUST carry the supporting evidence used to verify it — the agent is
 * required to call a tool and get a real result before asserting a claim, and
 * that result travels with the fact so the UI can show "why this is true".
 * The schema enforces this: `evidence` is non-optional.
 */

export const FactCategorySchema = z.enum([
  "milestone", // e.g. player's 100th goal
  "record", // all-time / club / competition record
  "streak", // consecutive run (wins, scoring, etc.)
  "first", // "first time in N years/ever"
  "head_to_head", // historical matchup context
  "rarity", // statistically unusual moment
  "context", // general background color
]);
export type FactCategory = z.infer<typeof FactCategorySchema>;

/** The verifying query + its result that backs a fact. */
export const FactEvidenceSchema = z.object({
  /** Human-readable description of how the fact was checked. */
  description: z.string().min(1),
  /** The tool/query invoked (e.g. SQL or tool name + args). */
  query: z.string().min(1),
  /** The result returned by the tool that supports the claim. */
  result: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  /** Where the underlying data came from (e.g. "statsbomb-history"). */
  source: z.string().min(1),
});
export type FactEvidence = z.infer<typeof FactEvidenceSchema>;

export const FactSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().min(1),
  /** The event that triggered generation of this fact. */
  eventId: z.string().uuid(),
  /** The broadcast-ready sentence shown to the announcer. */
  text: z.string().min(1),
  category: FactCategorySchema,
  /** Model confidence that the fact is correct and relevant (0..1). */
  confidence: z.number().min(0).max(1),
  /** Verification evidence — required, so unverified facts are not valid. */
  evidence: FactEvidenceSchema,
  /** ISO-8601 timestamp when the fact was generated (accepts `Z` or an offset). */
  createdAt: z.string().datetime({ offset: true }),
});
export type Fact = z.infer<typeof FactSchema>;

/** Parse-or-throw helper for service boundaries. */
export function parseFact(input: unknown): Fact {
  return FactSchema.parse(input);
}
