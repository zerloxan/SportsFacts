import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GameEventSchema, parseGameEvent } from "./events.js";
import { FactSchema } from "./facts.js";

test("valid goal event passes validation", () => {
  const event = {
    id: randomUUID(),
    matchId: "3795506",
    sequence: 42,
    period: 1,
    minute: 23,
    second: 11,
    timelineOffsetMs: 1_391_000,
    team: { id: 217, name: "Barcelona" },
    player: { id: 5503, name: "Lionel Messi" },
    type: "goal",
    details: {
      xg: 0.34,
      scoreAfter: { home: 1, away: 0 },
    },
  };
  const parsed = parseGameEvent(event);
  assert.equal(parsed.type, "goal");
});

test("event missing required type is rejected", () => {
  const bad = {
    id: randomUUID(),
    matchId: "3795506",
    sequence: 1,
    period: 1,
    minute: 0,
    second: 0,
    timelineOffsetMs: 0,
    team: { id: 217, name: "Barcelona" },
    // type omitted
  };
  const result = GameEventSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("fact requires supporting evidence", () => {
  const withoutEvidence = {
    id: randomUUID(),
    matchId: "3795506",
    eventId: randomUUID(),
    text: "First time this club has scored 3 first-half goals away in 50 years.",
    category: "first",
    confidence: 0.92,
    createdAt: new Date().toISOString(),
    // evidence omitted
  };
  assert.equal(FactSchema.safeParse(withoutEvidence).success, false);

  const withEvidence = {
    ...withoutEvidence,
    evidence: {
      description: "Counted away matches with 3+ first-half goals since 1974",
      query: "SELECT ... FROM events WHERE ...",
      result: { lastOccurrence: "1974-03-02", countSince: 0 },
      source: "statsbomb-history",
    },
  };
  assert.equal(FactSchema.safeParse(withEvidence).success, true);
});
