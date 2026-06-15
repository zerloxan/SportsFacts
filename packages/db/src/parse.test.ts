import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGoalRows, playersFromGoals, type SbEvent } from "./parse.js";

const events: SbEvent[] = [
  {
    id: "g1",
    period: 1,
    minute: 22,
    type: { name: "Shot" },
    team: { id: 779, name: "Argentina" },
    player: { id: 5503, name: "Lionel Messi" },
    shot: { outcome: { name: "Goal" }, type: { name: "Penalty" } },
  },
  {
    id: "s1",
    period: 1,
    minute: 25,
    type: { name: "Shot" },
    team: { id: 779, name: "Argentina" },
    player: { id: 5503, name: "Lionel Messi" },
    shot: { outcome: { name: "Saved" } },
  },
  {
    id: "pk1",
    period: 5,
    minute: 120,
    type: { name: "Shot" },
    team: { id: 779, name: "Argentina" },
    player: { id: 28263, name: "Gonzalo Montiel" },
    shot: { outcome: { name: "Goal" }, type: { name: "Penalty" } },
  },
  { id: "p1", period: 1, minute: 10, type: { name: "Pass" } },
];

test("extracts only scored goals with correct flags", () => {
  const rows = extractGoalRows(events, 3869685);
  assert.equal(rows.length, 2); // saved shot + pass excluded
  const open = rows.find((r) => r.statsbombEventId === "g1")!;
  assert.equal(open.penalty, true);
  assert.equal(open.shootout, false);
  assert.equal(open.playerId, 5503);
  const pk = rows.find((r) => r.statsbombEventId === "pk1")!;
  assert.equal(pk.shootout, true); // period 5
});

test("dedupes players from goals", () => {
  const ps = playersFromGoals(events);
  assert.equal(ps.length, 2);
  assert.ok(ps.some((p) => p.playerId === 5503));
});
