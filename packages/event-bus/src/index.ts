import { InMemoryEventBus } from "./inMemoryBus.js";
import { RedisEventBus } from "./redisBus.js";
import type { EventBus } from "./types.js";

export type { EventBus, MessageHandler, Unsubscribe } from "./types.js";
export { InMemoryEventBus } from "./inMemoryBus.js";
export { RedisEventBus } from "./redisBus.js";

/** Well-known topic names shared across services. */
export const Topics = {
  events: "game.events",
  facts: "game.facts",
} as const;

/**
 * Create the EventBus implementation selected by configuration: Redis Streams
 * when `redisUrl` (or `process.env.REDIS_URL`) is set, otherwise in-memory.
 */
export function createEventBus(
  redisUrl: string | undefined = process.env.REDIS_URL,
): EventBus {
  if (redisUrl && redisUrl.trim().length > 0) {
    return new RedisEventBus(redisUrl);
  }
  return new InMemoryEventBus();
}
