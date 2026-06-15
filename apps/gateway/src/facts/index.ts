import type { History, MatchMeta } from "../matchData.js";
import type { FactGenerator } from "./types.js";
import { DeterministicFactGenerator } from "./deterministic.js";
import { HttpFactGenerator } from "./http.js";

export type { FactGenerator } from "./types.js";
export { DeterministicFactGenerator } from "./deterministic.js";
export { HttpFactGenerator } from "./http.js";

export interface FactGeneratorOptions {
  /** When set, fact generation is routed to the Python AI service if ready. */
  aiServiceUrl?: string | undefined;
}

/**
 * Select the fact generator. Prefers the Python LangGraph + Claude agent when
 * `aiServiceUrl` is set AND the service reports ready (has an API key);
 * otherwise uses the deterministic generator. The choice is logged.
 */
export async function createFactGenerator(
  meta: MatchMeta,
  history: History,
  options: FactGeneratorOptions = {},
): Promise<FactGenerator> {
  const { aiServiceUrl } = options;
  if (aiServiceUrl) {
    const ready = await probeReady(aiServiceUrl);
    if (ready) {
      console.log(`[gateway] using AI fact agent at ${aiServiceUrl}`);
      return new HttpFactGenerator(aiServiceUrl, meta.matchId);
    }
    console.log(
      `[gateway] AI service at ${aiServiceUrl} not ready (no API key?) — ` +
        `falling back to deterministic generator`,
    );
  }
  return new DeterministicFactGenerator(meta, history);
}

async function probeReady(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ready?: boolean };
    return body.ready === true;
  } catch {
    return false;
  }
}
