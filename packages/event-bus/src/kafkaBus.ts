import {
  Kafka,
  logLevel,
  Partitioners,
  type Producer,
  type Consumer,
} from "kafkajs";
import type { EventBus, MessageHandler, Unsubscribe } from "./types.js";

/** Topics that must exist before the first produce. */
const REQUIRED_TOPICS = ["game.events", "game.facts"];

/**
 * Kafka-backed EventBus using KafkaJS. Each subscription creates an
 * independent consumer group so every subscriber sees every message
 * (fan-out), matching the in-memory/Redis semantics.
 *
 * Producer and topic provisioning are lazy: the first `publish` call
 * triggers an idempotent admin create + producer connect. Consumers
 * connect eagerly on `subscribe`. `createEventBus()` can therefore
 * stay synchronous.
 */
export class KafkaEventBus implements EventBus {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers = new Set<Consumer>();
  private readonly groupIdBase: string;
  private initPromise: Promise<void> | null = null;
  private subCount = 0;
  private closed = false;

  constructor(
    brokers: string[],
    clientId = "sportsfacts",
    groupId = "sportsfacts",
  ) {
    this.groupIdBase = groupId;
    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
  }

  /** Idempotent: provision topics then connect the shared producer (once). */
  private init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const admin = this.kafka.admin();
        await admin.connect();
        try {
          await admin.createTopics({
            waitForLeaders: true,
            topics: REQUIRED_TOPICS.map((topic) => ({
              topic,
              numPartitions: 1,
              replicationFactor: 1,
            })),
          });
        } finally {
          await admin.disconnect();
        }
        await this.producer.connect();
      })();
    }
    return this.initPromise;
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    await this.init();
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async subscribe<T>(
    topic: string,
    handler: MessageHandler<T>,
  ): Promise<Unsubscribe> {
    // Unique group per subscription → every subscriber sees every message
    const groupId = `${this.groupIdBase}-sub-${++this.subCount}`;
    const consumer = this.kafka.consumer({ groupId });
    this.consumers.add(consumer);
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!this.closed && message.value) {
          await handler(JSON.parse(message.value.toString()) as T);
        }
      },
    });
    return async () => {
      this.consumers.delete(consumer);
      await consumer.disconnect();
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    const disconnects = [...this.consumers].map((c) => c.disconnect());
    this.consumers.clear();
    await Promise.all(disconnects);
    // Always attempt producer disconnect so unit tests can call close() safely
    try {
      await this.producer.disconnect();
    } catch {
      // No-op when producer was never connected
    }
  }
}
