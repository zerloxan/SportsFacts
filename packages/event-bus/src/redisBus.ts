import { Redis } from "ioredis";
import type { EventBus, MessageHandler, Unsubscribe } from "./types.js";

/**
 * Redis-Streams EventBus. Each topic maps to a Redis Stream; subscribers read
 * with `XREAD BLOCK` from the tail. This is the "phase 2" backend that gives a
 * durable, replayable log and lets the replay/fact/gateway processes be split
 * across machines. Selected when `REDIS_URL` is configured.
 *
 * Note: this is a pragmatic fan-out implementation (every subscriber sees every
 * new message). Consumer-group semantics can be layered on per topic later.
 */
export class RedisEventBus implements EventBus {
  private readonly pub: Redis;
  private readonly subscribers = new Set<Redis>();
  private closed = false;

  constructor(private readonly url: string) {
    this.pub = new Redis(url);
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    await this.pub.xadd(topic, "*", "data", JSON.stringify(message));
  }

  async subscribe<T>(
    topic: string,
    handler: MessageHandler<T>,
  ): Promise<Unsubscribe> {
    const conn = new Redis(this.url);
    this.subscribers.add(conn);
    let lastId = "$"; // start from new messages only
    let active = true;

    const loop = async (): Promise<void> => {
      while (active && !this.closed) {
        try {
          const res = (await conn.xread(
            "BLOCK",
            5000,
            "STREAMS",
            topic,
            lastId,
          )) as [string, [string, string[]][]][] | null;
          if (!res) continue;
          for (const [, entries] of res) {
            for (const [id, fields] of entries) {
              lastId = id;
              const idx = fields.indexOf("data");
              const data = idx >= 0 ? fields[idx + 1] : undefined;
              if (data !== undefined) {
                await handler(JSON.parse(data) as T);
              }
            }
          }
        } catch {
          if (!active || this.closed) break;
        }
      }
    };
    void loop();

    return () => {
      active = false;
      this.subscribers.delete(conn);
      conn.disconnect();
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const conn of this.subscribers) conn.disconnect();
    this.subscribers.clear();
    this.pub.disconnect();
  }
}
