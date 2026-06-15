import { InMemoryEventBus } from "./inMemoryBus.js";
import { RedisEventBus } from "./redisBus.js";
import { KafkaEventBus } from "./kafkaBus.js";
import type { EventBus } from "./types.js";

export type { EventBus, MessageHandler, Unsubscribe } from "./types.js";
export { InMemoryEventBus } from "./inMemoryBus.js";
export { RedisEventBus } from "./redisBus.js";
export { KafkaEventBus } from "./kafkaBus.js";

/** Well-known topic names shared across services. */
export const Topics = {
  events: "game.events",
  facts: "game.facts",
} as const;

/**
 * Create the EventBus implementation selected by configuration.
 * Precedence: Kafka (`kafkaBrokers` / `KAFKA_BROKERS`) → Redis (`redisUrl` /
 * `REDIS_URL`) → in-memory. No consumer code changes required when switching.
 */
export function createEventBus(
  redisUrl: string | undefined = process.env.REDIS_URL,
  kafkaBrokers: string | undefined = process.env.KAFKA_BROKERS,
  kafkaClientId: string | undefined = process.env.KAFKA_CLIENT_ID,
  kafkaGroupId: string | undefined = process.env.KAFKA_GROUP_ID,
): EventBus {
  const brokers = kafkaBrokers
    ?.split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  if (brokers && brokers.length > 0) {
    return new KafkaEventBus(brokers, kafkaClientId, kafkaGroupId);
  }
  if (redisUrl && redisUrl.trim().length > 0) {
    return new RedisEventBus(redisUrl);
  }
  return new InMemoryEventBus();
}
