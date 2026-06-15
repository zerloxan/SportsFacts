import type { GameEvent, Fact } from "@sportsfacts/shared-types";
import type { MatchMeta } from "./matchData.js";

/** Current replay/playback state broadcast to clients. */
export interface ReplayState {
  status: "idle" | "playing" | "paused" | "finished";
  speed: number;
  /** Index of the next event to emit. */
  cursor: number;
  total: number;
  score: { home: number; away: number };
  clockMinute: number;
}

/** Sent once when a client connects, so late joiners catch up. */
export interface Snapshot {
  meta: MatchMeta;
  state: ReplayState;
  recentEvents: GameEvent[];
  recentFacts: Fact[];
}

/**
 * Single discriminated envelope for everything the gateway pushes over the
 * WebSocket. Clients switch on `kind`.
 */
export type ServerMessage =
  | { kind: "snapshot"; data: Snapshot }
  | { kind: "event"; data: GameEvent }
  | { kind: "fact"; data: Fact }
  | { kind: "state"; data: ReplayState };
