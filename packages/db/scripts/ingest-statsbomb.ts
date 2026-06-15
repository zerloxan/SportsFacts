/**
 * Ingest a StatsBomb competition's matches, players, and goals into Postgres.
 * Idempotent: re-running upserts by natural key. Defaults to the 2022 World Cup
 * (competition 43, season 106).
 *
 * Usage: pnpm --filter @sportsfacts/db db:ingest
 */
import { sql } from "drizzle-orm";
import { createDb, matches, players, goals } from "../src/index.js";
import {
  extractGoalRows,
  playersFromGoals,
  type SbEvent,
} from "../src/parse.js";

const COMPETITION_ID = Number(process.env.SB_COMPETITION ?? 43);
const SEASON_ID = Number(process.env.SB_SEASON ?? 106);
const RAW = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";

interface SbMatch {
  match_id: number;
  match_date: string;
  competition: { competition_name: string };
  season: { season_name: string };
  competition_stage?: { name: string };
  home_team: { home_team_id: number; home_team_name: string };
  away_team: { away_team_id: number; away_team_name: string };
  home_score: number;
  away_score: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const { sql: client, db } = createDb();
  const matchList = await fetchJson<SbMatch[]>(
    `${RAW}/matches/${COMPETITION_ID}/${SEASON_ID}.json`,
  );
  console.log(
    `[ingest] ${matchList.length} matches for competition ${COMPETITION_ID}/${SEASON_ID}`,
  );

  let goalCount = 0;
  for (const [i, m] of matchList.entries()) {
    await db
      .insert(matches)
      .values({
        matchId: m.match_id,
        competitionId: COMPETITION_ID,
        seasonId: SEASON_ID,
        competitionName: m.competition.competition_name,
        seasonName: m.season.season_name,
        stage: m.competition_stage?.name ?? null,
        matchDate: m.match_date,
        homeTeamId: m.home_team.home_team_id,
        homeTeamName: m.home_team.home_team_name,
        awayTeamId: m.away_team.away_team_id,
        awayTeamName: m.away_team.away_team_name,
        homeScore: m.home_score,
        awayScore: m.away_score,
      })
      .onConflictDoUpdate({
        target: matches.matchId,
        set: {
          matchDate: m.match_date,
          homeScore: m.home_score,
          awayScore: m.away_score,
        },
      });

    const events = await fetchJson<SbEvent[]>(
      `${RAW}/events/${m.match_id}.json`,
    );

    // Upsert players seen as scorers.
    const playerRows = playersFromGoals(events);
    if (playerRows.length > 0) {
      await db
        .insert(players)
        .values(playerRows)
        .onConflictDoUpdate({
          target: players.playerId,
          set: { name: sql`excluded.name` },
        });
    }

    const goalRows = extractGoalRows(events, m.match_id);
    if (goalRows.length > 0) {
      await db.insert(goals).values(goalRows).onConflictDoNothing({
        target: goals.statsbombEventId,
      });
      goalCount += goalRows.length;
    }

    if ((i + 1) % 10 === 0 || i + 1 === matchList.length) {
      console.log(
        `[ingest] ${i + 1}/${matchList.length} matches, ${goalCount} goals so far`,
      );
    }
  }

  await client.end();
  console.log(`[ingest] done: ${matchList.length} matches, ${goalCount} goals`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
