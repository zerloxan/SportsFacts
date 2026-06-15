/**
 * Normalize a StatsBomb match into the canonical SportsFacts artifact:
 *   { meta, events: GameEvent[], history }
 *
 * Usage: pnpm --filter @sportsfacts/gateway normalize -- <matchId>
 * Defaults to the 2022 World Cup Final (3869685).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GameEventSchema, type GameEvent } from "@sportsfacts/shared-types";
import type { MatchMeta, History } from "../src/matchData.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const matchId = process.argv[2] ?? "3869685";
const competitionId = "43";
const seasonId = "106";

interface SbTeam {
  id: number;
  name: string;
}
interface SbEvent {
  id: string;
  index: number;
  period: number;
  minute: number;
  second: number;
  type: { name: string };
  team?: SbTeam;
  player?: { id: number; name: string };
  shot?: {
    outcome?: { name: string };
    statsbomb_xg?: number;
    type?: { name: string };
  };
  substitution?: {
    replacement?: { id: number; name: string };
    outcome?: { name: string };
  };
  foul_committed?: { card?: { name: string } };
  bad_behaviour?: { card?: { name: string } };
}

function cardKind(name: string): "yellow" | "second_yellow" | "red" | null {
  if (/second yellow/i.test(name)) return "second_yellow";
  if (/yellow/i.test(name)) return "yellow";
  if (/red/i.test(name)) return "red";
  return null;
}

/** Absolute seconds from kickoff; shootout kicks are spaced artificially. */
function timelineSeconds(ev: SbEvent, shootoutIndex: number): number {
  if (ev.period >= 5) return 120 * 60 + shootoutIndex * 25;
  return ev.minute * 60 + ev.second;
}

async function main(): Promise<void> {
  const eventsPath = resolve(repoRoot, `data/statsbomb/events/${matchId}.json`);
  const matchesPath = resolve(
    repoRoot,
    `data/statsbomb/matches/${competitionId}_${seasonId}.json`,
  );
  const sbEvents = JSON.parse(await readFile(eventsPath, "utf8")) as SbEvent[];
  const matches = JSON.parse(await readFile(matchesPath, "utf8")) as Array<{
    match_id: number;
    match_date: string;
    stadium?: { name: string };
    competition_stage?: { name: string };
    competition?: { competition_name: string };
    season?: { season_name: string };
    home_team: { home_team_id: number; home_team_name: string };
    away_team: { away_team_id: number; away_team_name: string };
    home_score: number;
    away_score: number;
  }>;
  const m = matches.find((x) => String(x.match_id) === matchId);
  if (!m) throw new Error(`Match ${matchId} not found in matches file`);

  const home = {
    id: m.home_team.home_team_id,
    name: m.home_team.home_team_name,
  };
  const away = {
    id: m.away_team.away_team_id,
    name: m.away_team.away_team_name,
  };

  const meta: MatchMeta = {
    matchId,
    competition:
      `${m.competition?.competition_name ?? "Competition"} ${m.season?.season_name ?? ""}`.trim(),
    stage: m.competition_stage?.name ?? "",
    date: m.match_date,
    stadium: m.stadium?.name,
    home,
    away,
    finalScore: { home: m.home_score, away: m.away_score },
    wentToPenalties: sbEvents.some((e) => e.period >= 5),
    shootoutScore: null,
  };

  const ordered = [...sbEvents].sort((a, b) => a.index - b.index);
  const score = { home: 0, away: 0 };
  const shootout = { home: 0, away: 0 };
  let shootoutIndex = 0;
  let sequence = 0;
  const events: GameEvent[] = [];

  const sideOf = (t?: SbTeam): "home" | "away" | null =>
    !t ? null : t.id === home.id ? "home" : t.id === away.id ? "away" : null;

  const base = {
    matchId,
  };

  for (const ev of ordered) {
    if (!ev.team) continue;
    const side = sideOf(ev.team);
    const isShootout = ev.period >= 5;
    if (isShootout) shootoutIndex++;
    const offsetSec = timelineSeconds(ev, shootoutIndex);

    const common = {
      ...base,
      id: ev.id,
      sequence: sequence++,
      period: ev.period,
      minute: ev.minute,
      second: ev.second,
      timelineOffsetMs: offsetSec * 1000,
      team: { id: ev.team.id, name: ev.team.name },
      ...(ev.player
        ? { player: { id: ev.player.id, name: ev.player.name } }
        : {}),
    };

    let normalized: unknown | null = null;

    if (ev.type.name === "Shot" && ev.shot?.outcome?.name === "Goal") {
      if (isShootout) {
        if (side === "home") shootout.home++;
        else if (side === "away") shootout.away++;
        normalized = {
          ...common,
          type: "goal",
          details: {
            xg: ev.shot.statsbomb_xg,
            scoreAfter: { home: score.home, away: score.away },
            shootout: true,
            shootoutAfter: { home: shootout.home, away: shootout.away },
          },
        };
      } else {
        if (side === "home") score.home++;
        else if (side === "away") score.away++;
        normalized = {
          ...common,
          type: "goal",
          details: {
            xg: ev.shot.statsbomb_xg,
            scoreAfter: { home: score.home, away: score.away },
            penalty: ev.shot.type?.name === "Penalty",
          },
        };
      }
    } else if (ev.type.name === "Shot" && !isShootout) {
      normalized = {
        ...common,
        type: "shot",
        details: {
          xg: ev.shot?.statsbomb_xg,
          outcome: ev.shot?.outcome?.name ?? "Unknown",
          onTarget: ["Saved", "Goal"].includes(ev.shot?.outcome?.name ?? ""),
        },
      };
    } else if (
      ev.type.name === "Substitution" &&
      ev.substitution?.replacement &&
      ev.player
    ) {
      normalized = {
        ...common,
        type: "substitution",
        details: {
          playerOff: { id: ev.player.id, name: ev.player.name },
          playerOn: {
            id: ev.substitution.replacement.id,
            name: ev.substitution.replacement.name,
          },
        },
      };
    } else if (
      cardKind(
        ev.foul_committed?.card?.name ?? ev.bad_behaviour?.card?.name ?? "",
      )
    ) {
      const ck = cardKind(
        ev.foul_committed?.card?.name ?? ev.bad_behaviour?.card?.name ?? "",
      )!;
      normalized = { ...common, type: "card", details: { card: ck } };
    } else if (
      ev.type.name === "Half Start" &&
      ev.period === 1 &&
      sequence <= 3
    ) {
      normalized = { ...common, type: "kickoff", details: {} };
    } else if (ev.type.name === "Half End") {
      normalized = {
        ...common,
        type: "half_end",
        details: { period: ev.period },
      };
    }

    if (normalized) {
      // Validate as we build — fail loudly on contract drift.
      events.push(GameEventSchema.parse(normalized));
    }
  }

  meta.shootoutScore = meta.wentToPenalties ? shootout : null;

  // Curated, verifiable history table (evidence source for the fact engine).
  const history: History = {
    preMatchTournamentGoals: {
      "5503": { name: "Lionel Messi", goals: 5 },
      "3009": { name: "Kylian Mbappé", goals: 5 },
      "2995": { name: "Ángel Di María", goals: 0 },
    },
    nicknames: {
      "5503": "Messi",
      "3009": "Mbappé",
      "2995": "Di María",
      "5743": "Dybala",
      "16308": "Paredes",
      "22097": "Kolo Muani",
      "28263": "Montiel",
    },
    records: [
      {
        id: "wc-final-hat-trick",
        kind: "first-since",
        text: "Last hat-trick in a men's World Cup final: Geoff Hurst, 1966",
        data: { player: "Geoff Hurst", year: 1966, opponent: "West Germany" },
      },
      {
        id: "golden-boot-race",
        kind: "context",
        text: "Both Messi and Mbappé entered the final on 5 goals — level in the Golden Boot race",
        data: { messi: 5, mbappe: 5 },
      },
    ],
  };

  const outDir = resolve(repoRoot, "data/normalized");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `${matchId}.json`);
  await writeFile(
    outPath,
    JSON.stringify({ meta, events, history }, null, 2),
    "utf8",
  );

  console.log(
    `Normalized ${matchId}: ${events.length} significant events, ` +
      `final ${meta.home.name} ${meta.finalScore.home}-${meta.finalScore.away} ${meta.away.name}` +
      (meta.wentToPenalties
        ? ` (pens ${shootout.home}-${shootout.away})`
        : "") +
      `\n→ ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
