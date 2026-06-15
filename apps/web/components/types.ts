import type { GameEvent, Fact } from "@sportsfacts/shared-types";

/** Mirrors the gateway's WS envelope (apps/gateway/src/wsEnvelope.ts). */
export interface ReplayState {
  status: "idle" | "playing" | "paused" | "finished";
  speed: number;
  cursor: number;
  total: number;
  score: { home: number; away: number };
  clockMinute: number;
}

export interface MatchMeta {
  matchId: string;
  competition: string;
  stage: string;
  date: string;
  stadium?: string;
  home: { id: number; name: string };
  away: { id: number; name: string };
  finalScore: { home: number; away: number };
  wentToPenalties: boolean;
  shootoutScore: { home: number; away: number } | null;
}

export interface Snapshot {
  meta: MatchMeta;
  state: ReplayState;
  recentEvents: GameEvent[];
  recentFacts: Fact[];
}

export type ServerMessage =
  | { kind: "snapshot"; data: Snapshot }
  | { kind: "event"; data: GameEvent }
  | { kind: "fact"; data: Fact }
  | { kind: "state"; data: ReplayState };

export type { GameEvent, Fact };
