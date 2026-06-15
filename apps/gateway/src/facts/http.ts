import {
  FactSchema,
  type GameEvent,
  type Fact,
} from "@sportsfacts/shared-types";
import type { FactGenerator } from "./types.js";

/**
 * Routes fact generation to the Python AI service (LangGraph + Claude) over
 * HTTP. Used when `AI_SERVICE_URL` is set and the service reports ready. Each
 * returned fact is re-validated against the canonical `Fact` schema; anything
 * invalid is dropped. Network errors degrade to an empty fact list so the live
 * stream never breaks.
 */
export class HttpFactGenerator implements FactGenerator {
  readonly name: string;
  private warned = false;

  constructor(
    private readonly baseUrl: string,
    private readonly matchId: string,
  ) {
    this.name = `langgraph-claude (http: ${baseUrl})`;
  }

  async onEvent(event: GameEvent): Promise<Fact[]> {
    try {
      const res = await fetch(`${this.baseUrl}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { facts?: unknown[] };
      const facts: Fact[] = [];
      for (const raw of body.facts ?? []) {
        const parsed = FactSchema.safeParse(raw);
        if (parsed.success) facts.push(parsed.data);
      }
      return facts;
    } catch (err) {
      if (!this.warned) {
        this.warned = true;
        console.warn(
          `[gateway] AI service call failed, returning no facts:`,
          err,
        );
      }
      return [];
    }
  }

  reset(): void {
    void fetch(`${this.baseUrl}/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId: this.matchId }),
    }).catch(() => {});
  }
}
