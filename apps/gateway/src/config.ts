import { resolve } from "node:path";

export interface GatewayConfig {
  port: number;
  host: string;
  /** Path to the normalized match artifact. */
  dataFile: string;
  /** When set, the Redis EventBus is used instead of in-memory. */
  redisUrl: string | undefined;
  /** Comma-separated Kafka brokers. When set, the Kafka EventBus is used (takes precedence over Redis). */
  kafkaBrokers: string | undefined;
  /** KafkaJS client ID. */
  kafkaClientId: string | undefined;
  /** Kafka consumer group ID base. */
  kafkaGroupId: string | undefined;
  /** When set, fact generation is routed to the Python AI service if ready. */
  aiServiceUrl: string | undefined;
  /** Default replay speed multiplier. */
  defaultSpeed: number;
  /** Whether replay auto-starts on boot. */
  autostart: boolean;
}

export function loadConfig(): GatewayConfig {
  const repoRoot = resolve(process.cwd());
  return {
    port: Number(process.env.GATEWAY_PORT ?? 8787),
    host: process.env.GATEWAY_HOST ?? "0.0.0.0",
    dataFile:
      process.env.MATCH_DATA_FILE ??
      resolve(repoRoot, "data/normalized/3869685.json"),
    redisUrl: process.env.REDIS_URL,
    kafkaBrokers: process.env.KAFKA_BROKERS,
    kafkaClientId: process.env.KAFKA_CLIENT_ID,
    kafkaGroupId: process.env.KAFKA_GROUP_ID,
    aiServiceUrl: process.env.AI_SERVICE_URL,
    defaultSpeed: Number(process.env.REPLAY_SPEED ?? 60),
    autostart: process.env.REPLAY_AUTOSTART !== "false",
  };
}
