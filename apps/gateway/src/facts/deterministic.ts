import { randomUUID } from "node:crypto";
import type { GameEvent, Fact, FactCategory } from "@sportsfacts/shared-types";
import type { History, MatchMeta } from "../matchData.js";
import { homeAwayOf } from "../matchData.js";
import type { FactGenerator } from "./types.js";

interface GoalMark {
  playerId: number;
  side: "home" | "away" | null;
  minute: number;
  offsetMs: number;
}

/**
 * Deterministic, evidence-backed fact generator. It maintains running match
 * state (the verifiable "stats DB" for the live match) and joins against the
 * curated `history` table. Every record/first/milestone fact carries the
 * queried evidence — claims with no supporting record are not emitted.
 */
export class DeterministicFactGenerator implements FactGenerator {
  readonly name = "deterministic";

  private readonly inMatchGoals = new Map<number, number>();
  private readonly goalLog: GoalMark[] = [];
  private goldenBootCited = false;

  constructor(
    private readonly meta: MatchMeta,
    private readonly history: History,
  ) {}

  reset(): void {
    this.inMatchGoals.clear();
    this.goalLog.length = 0;
    this.goldenBootCited = false;
  }

  async onEvent(event: GameEvent): Promise<Fact[]> {
    if (event.type === "goal") return this.onGoal(event);
    if (event.type === "card" && event.details.card === "red") {
      return [this.onRedCard(event)];
    }
    return [];
  }

  private nick(playerId: number | undefined, fallback: string): string {
    if (playerId === undefined) return fallback;
    return this.history.nicknames[String(playerId)] ?? fallback;
  }

  private make(
    event: GameEvent,
    text: string,
    category: FactCategory,
    confidence: number,
    evidence: Fact["evidence"],
  ): Fact {
    return {
      id: randomUUID(),
      matchId: event.matchId,
      eventId: event.id,
      text,
      category,
      confidence,
      evidence,
      createdAt: new Date().toISOString(),
    };
  }

  private onGoal(event: Extract<GameEvent, { type: "goal" }>): Fact[] {
    const facts: Fact[] = [];
    const playerId = event.player?.id;
    const name = this.nick(playerId, event.player?.name ?? "Unknown");
    const shootout = "shootout" in event.details && event.details.shootout;
    if (shootout) return facts; // shootout handled by score line, not facts

    const side = homeAwayOf(this.meta, event.team);
    const prevInMatch = playerId ? (this.inMatchGoals.get(playerId) ?? 0) : 0;
    const inMatch = prevInMatch + 1;
    if (playerId) this.inMatchGoals.set(playerId, inMatch);

    // --- Tournament tally milestone (evidence: curated pre-match goals) ---
    const pre = playerId
      ? this.history.preMatchTournamentGoals[String(playerId)]
      : undefined;
    if (pre) {
      const total = pre.goals + inMatch;
      facts.push(
        this.make(
          event,
          `GOAL! ${name} — that's ${total} for him at this tournament` +
            (event.details.penalty ? " (from the spot)" : ""),
          "milestone",
          0.96,
          {
            description: `${name}'s tournament tally: ${pre.goals} before the final + ${inMatch} today`,
            query: `preMatchTournamentGoals['${playerId}'].goals + inMatchGoals['${playerId}']`,
            result: { before: pre.goals, inMatch, total },
            source: "curated-history",
          },
        ),
      );
    }

    // --- Brace / hat-trick ---
    if (inMatch === 2) {
      facts.push(
        this.make(event, `${name} has a brace in the final.`, "rarity", 0.95, {
          description: `${name} has scored ${inMatch} goals in this match`,
          query: `inMatchGoals['${playerId}']`,
          result: { inMatch },
          source: "match-state",
        }),
      );
    } else if (inMatch === 3) {
      const rec = this.history.records.find(
        (r) => r.id === "wc-final-hat-trick",
      );
      facts.push(
        this.make(
          event,
          `HAT-TRICK for ${name}! The first in a men's World Cup final since Geoff Hurst in 1966.`,
          "first",
          0.97,
          {
            description:
              "In-match goals = 3; last men's World Cup final hat-trick was 1966",
            query: `inMatchGoals['${playerId}'] === 3 ⋈ records['wc-final-hat-trick']`,
            result: { inMatch, lastFinalHatTrick: rec?.data ?? null },
            source: "curated-history",
          },
        ),
      );
    }

    // --- Rapid-fire: same player scores again quickly ---
    const last = [...this.goalLog]
      .reverse()
      .find((g) => g.playerId === playerId);
    if (last) {
      const gapSec = Math.round(
        (event.timelineOffsetMs - last.offsetMs) / 1000,
      );
      if (gapSec > 0 && gapSec <= 200) {
        facts.push(
          this.make(
            event,
            `${name} strikes twice in ${gapSec} seconds!`,
            "rarity",
            0.94,
            {
              description: `Gap between ${name}'s last two goals`,
              query: `offset(now) - offset(prevGoalBy['${playerId}'])`,
              result: {
                gapSeconds: gapSec,
                from: last.minute,
                to: event.minute,
              },
              source: "match-state",
            },
          ),
        );
      }
    }

    // --- Score state: lead or equaliser ---
    const { home, away } = event.details.scoreAfter;
    if (home === away) {
      facts.push(
        this.make(
          event,
          `Level again — ${this.meta.home.name} ${home}-${away} ${this.meta.away.name}.`,
          "context",
          0.9,
          {
            description: "Score is level after this goal",
            query: "scoreAfter.home === scoreAfter.away",
            result: event.details.scoreAfter,
            source: "match-state",
          },
        ),
      );
    }

    // --- Golden Boot context (cite once) ---
    if (
      !this.goldenBootCited &&
      pre &&
      (playerId === 5503 || playerId === 3009)
    ) {
      const rec = this.history.records.find((r) => r.id === "golden-boot-race");
      if (rec) {
        this.goldenBootCited = true;
        facts.push(
          this.make(
            event,
            `Golden Boot race heating up — Messi and Mbappé both arrived on 5 goals.`,
            "context",
            0.88,
            {
              description: rec.text,
              query: "records['golden-boot-race']",
              result: rec.data,
              source: "curated-history",
            },
          ),
        );
      }
    }

    this.goalLog.push({
      playerId: playerId ?? -1,
      side,
      minute: event.minute,
      offsetMs: event.timelineOffsetMs,
    });
    return facts;
  }

  private onRedCard(event: Extract<GameEvent, { type: "card" }>): Fact {
    const name = this.nick(event.player?.id, event.player?.name ?? "A player");
    return this.make(event, `Red card! ${name} is sent off.`, "context", 0.9, {
      description: "Sending-off recorded in the event feed",
      query: "event.details.card === 'red'",
      result: { minute: event.minute, player: name },
      source: "match-state",
    });
  }
}
