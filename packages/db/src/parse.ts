/** Pure helpers for turning raw StatsBomb events into goal rows. */

export interface SbEvent {
  id: string;
  period: number;
  minute: number;
  type: { name: string };
  team?: { id: number; name: string };
  player?: { id: number; name: string };
  shot?: { outcome?: { name: string }; type?: { name: string } };
}

export interface GoalRow {
  statsbombEventId: string;
  matchId: number;
  playerId: number;
  teamId: number;
  teamName: string;
  minute: number;
  period: number;
  penalty: boolean;
  shootout: boolean;
}

/** Extract scored-goal rows (Shot with outcome Goal) credited to the scorer. */
export function extractGoalRows(events: SbEvent[], matchId: number): GoalRow[] {
  const rows: GoalRow[] = [];
  for (const e of events) {
    if (
      e.type.name !== "Shot" ||
      e.shot?.outcome?.name !== "Goal" ||
      !e.player ||
      !e.team
    ) {
      continue;
    }
    rows.push({
      statsbombEventId: e.id,
      matchId,
      playerId: e.player.id,
      teamId: e.team.id,
      teamName: e.team.name,
      minute: e.minute,
      period: e.period,
      penalty: e.shot?.type?.name === "Penalty",
      shootout: e.period >= 5,
    });
  }
  return rows;
}

/** Unique players (id → most recent name) appearing as scorers in the rows. */
export function playersFromGoals(
  events: SbEvent[],
): { playerId: number; name: string }[] {
  const map = new Map<number, string>();
  for (const e of events) {
    if (
      e.type.name === "Shot" &&
      e.shot?.outcome?.name === "Goal" &&
      e.player
    ) {
      map.set(e.player.id, e.player.name);
    }
  }
  return [...map.entries()].map(([playerId, name]) => ({ playerId, name }));
}
