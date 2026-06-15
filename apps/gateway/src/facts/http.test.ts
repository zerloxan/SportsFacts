import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { HttpFactGenerator } from "./http.js";
import type { GameEvent } from "@sportsfacts/shared-types";

const originalFetch = globalThis.fetch;

function goal(): GameEvent {
  return {
    id: randomUUID(),
    matchId: "3869685",
    sequence: 1,
    period: 4,
    minute: 117,
    second: 0,
    timelineOffsetMs: 117 * 60_000,
    team: { id: 779, name: "Argentina" },
    player: { id: 3009, name: "Kylian Mbappé" },
    type: "goal",
    details: { scoreAfter: { home: 3, away: 3 } },
  };
}

function validFact() {
  return {
    id: randomUUID(),
    matchId: "3869685",
    eventId: randomUUID(),
    text: "HAT-TRICK for Mbappé!",
    category: "first",
    confidence: 0.97,
    evidence: {
      description: "3 goals this match",
      query: "query_in_match_state(3009)",
      result: { inMatchGoals: 3 },
      source: "match-state",
    },
    createdAt: new Date().toISOString(),
  };
}

test("maps the service response to validated Fact[]", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ facts: [validFact(), { bogus: true }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const gen = new HttpFactGenerator("http://localhost:9999", "3869685");
    const facts = await gen.onEvent(goal());
    assert.equal(facts.length, 1); // the bogus one is dropped by FactSchema
    assert.match(facts[0]!.text, /HAT-TRICK/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("network failure degrades to an empty fact list", async () => {
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };
  try {
    const gen = new HttpFactGenerator("http://localhost:9999", "3869685");
    const facts = await gen.onEvent(goal());
    assert.deepEqual(facts, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
