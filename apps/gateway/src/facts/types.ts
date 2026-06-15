import type { GameEvent, Fact } from "@sportsfacts/shared-types";

/**
 * A fact generator consumes live events (in order) and returns zero or more
 * evidence-backed facts. Implementations may keep running match state. The
 * deterministic generator is the default; a Claude-backed generator implements
 * the same interface and is selected when an API key is present.
 */
export interface FactGenerator {
  readonly name: string;
  onEvent(event: GameEvent): Promise<Fact[]>;
  /** Clear running match state (called when the replay restarts or seeks). */
  reset(): void;
}
