import { test } from "node:test";
import assert from "node:assert/strict";
import { FactSchema } from "@sportsfacts/shared-types";
import type { GameEvent } from "@sportsfacts/shared-types";
import { DeterministicFactGenerator } from "./deterministic.js";
import type { History, MatchMeta } from "../matchData.js";

const meta: MatchMeta = {
  matchId: "T",
  competition: "Test Cup",
  stage: "Final",
  date: "2022-12-18",
  home: { id: 1, name: "Argentina" },
  away: { id: 2, name: "France" },
  finalScore: { home: 3, away: 3 },
  wentToPenalties: true,
  shootoutScore: { home: 4, away: 2 },
};

const history: History = {
  preMatchTournamentGoals: { "3009": { name: "Kylian Mbappé", goals: 5 } },
  nicknames: { "3009": "Mbappé" },
  records: [
    {
      id: "wc-final-hat-trick",
      kind: "first-since",
      text: "Last final hat-trick: Geoff Hurst 1966",
      data: { player: "Geoff Hurst", year: 1966 },
    },
  ],
};

function goal(
  seq: number,
  minute: number,
  offsetMs: number,
  scoreAfter: { home: number; away: number },
): GameEvent {
  return {
    id: crypto.randomUUID(),
    matchId: "T",
    sequence: seq,
    period: 2,
    minute,
    second: 0,
    timelineOffsetMs: offsetMs,
    team: { id: 2, name: "France" },
    player: { id: 3009, name: "Kylian Mbappé Lottin" },
    type: "goal",
    details: { xg: 0.5, scoreAfter },
  };
}

test("goal emits an evidence-backed milestone fact that validates", async () => {
  const gen = new DeterministicFactGenerator(meta, history);
  const facts = await gen.onEvent(
    goal(1, 79, 79 * 60_000, { home: 2, away: 1 }),
  );
  assert.ok(facts.length >= 1);
  for (const f of facts) assert.equal(FactSchema.safeParse(f).success, true);
  const milestone = facts.find((f) => f.category === "milestone");
  assert.ok(milestone, "expected a milestone fact");
  assert.match(milestone.text, /Mbappé/);
  // evidence must reflect 5 before + 1 today = 6
  assert.deepEqual(milestone.evidence.result, {
    before: 5,
    inMatch: 1,
    total: 6,
  });
});

test("third goal yields a hat-trick 'first' fact citing the 1966 record", async () => {
  const gen = new DeterministicFactGenerator(meta, history);
  await gen.onEvent(goal(1, 79, 79 * 60_000, { home: 2, away: 1 }));
  await gen.onEvent(goal(2, 80, 80 * 60_000, { home: 2, away: 2 }));
  const third = await gen.onEvent(
    goal(3, 117, 117 * 60_000, { home: 3, away: 3 }),
  );
  const hatTrick = third.find((f) => f.category === "first");
  assert.ok(hatTrick, "expected a hat-trick 'first' fact");
  assert.match(hatTrick.text, /HAT-TRICK/i);
  assert.equal(hatTrick.evidence.source, "curated-history");
});

test("reset() clears running state so counts don't accumulate across passes", async () => {
  const gen = new DeterministicFactGenerator(meta, history);
  await gen.onEvent(goal(1, 79, 79 * 60_000, { home: 0, away: 1 }));
  gen.reset();
  // Same goal again after reset: should read as the player's 1st today, not 2nd.
  const facts = await gen.onEvent(
    goal(1, 79, 79 * 60_000, { home: 0, away: 1 }),
  );
  const milestone = facts.find((f) => f.category === "milestone");
  assert.ok(milestone);
  assert.deepEqual(milestone.evidence.result, {
    before: 5,
    inMatch: 1,
    total: 6,
  });
  assert.equal(
    facts.find((f) => f.category === "rarity"),
    undefined,
  );
});

test("no fabricated record for an unknown player", async () => {
  const gen = new DeterministicFactGenerator(meta, history);
  const unknown = goal(1, 10, 600_000, { home: 1, away: 0 });
  unknown.player = { id: 9999, name: "Nobody" };
  unknown.team = { id: 1, name: "Argentina" };
  const facts = await gen.onEvent(unknown);
  // no milestone (no pre-match tally) and no hat-trick
  assert.equal(
    facts.find((f) => f.category === "milestone"),
    undefined,
  );
  assert.equal(
    facts.find((f) => f.category === "first"),
    undefined,
  );
});
