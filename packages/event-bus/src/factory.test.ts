import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createEventBus } from "./index.js";
import { KafkaEventBus } from "./kafkaBus.js";
import { RedisEventBus } from "./redisBus.js";
import { InMemoryEventBus } from "./inMemoryBus.js";

// ── 4.1  Factory selection (unit; no broker needed) ────────────────────────

describe("createEventBus factory selection", () => {
  test("returns KafkaEventBus when KAFKA_BROKERS is set", async () => {
    const bus = createEventBus(undefined, "localhost:9092");
    try {
      assert.ok(bus instanceof KafkaEventBus);
    } finally {
      await bus.close();
    }
  });

  test("Kafka takes precedence over Redis when both provided", async () => {
    const bus = createEventBus("redis://localhost:6379", "localhost:9092");
    try {
      assert.ok(bus instanceof KafkaEventBus);
    } finally {
      await bus.close();
    }
  });

  test("returns RedisEventBus when REDIS_URL set and no Kafka brokers", async () => {
    const bus = createEventBus("redis://localhost:6379", undefined);
    try {
      assert.ok(bus instanceof RedisEventBus);
    } finally {
      await bus.close();
    }
  });

  test("returns InMemoryEventBus when neither Kafka nor Redis configured", async () => {
    const bus = createEventBus(undefined, undefined);
    assert.ok(bus instanceof InMemoryEventBus);
    await bus.close();
  });

  test("treats empty KAFKA_BROKERS string as unset", async () => {
    const bus = createEventBus(undefined, "");
    assert.ok(bus instanceof InMemoryEventBus);
    await bus.close();
  });

  test("parses comma-separated brokers", async () => {
    const bus = createEventBus(undefined, "broker1:9092,broker2:9092");
    try {
      assert.ok(bus instanceof KafkaEventBus);
    } finally {
      await bus.close();
    }
  });
});

// ── 4.2  Integration round-trip (skipped when no broker reachable) ─────────

const KAFKA_BROKERS = process.env.KAFKA_BROKERS;

const integrationSuite = KAFKA_BROKERS ? describe : describe.skip;

integrationSuite("KafkaEventBus round-trip (requires broker)", () => {
  let bus: KafkaEventBus;

  beforeEach(() => {
    const brokers = KAFKA_BROKERS!.split(",").map((b) => b.trim());
    bus = new KafkaEventBus(brokers, "sportsfacts-test", `sportsfacts-test-${Date.now()}`);
  });

  afterEach(async () => {
    await bus.close();
  });

  test("published message is received by subscriber", async () => {
    const received: unknown[] = [];
    const unsub = await bus.subscribe("game.events", (m: unknown) => {
      received.push(m);
    });

    // Give the consumer group a moment to join the partition
    await new Promise((r) => setTimeout(r, 1000));

    await bus.publish("game.events", { type: "goal", minute: 32 });

    // Wait up to 5 s for delivery
    const deadline = Date.now() + 5000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { type: "goal", minute: 32 });
    await unsub();
  });

  test("independent subscribers both receive the message (fan-out)", async () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const unsubA = await bus.subscribe("game.events", (m: unknown) => a.push(m));
    const unsubB = await bus.subscribe("game.events", (m: unknown) => b.push(m));

    await new Promise((r) => setTimeout(r, 1000));
    await bus.publish("game.events", { type: "card" });

    const deadline = Date.now() + 5000;
    while ((a.length === 0 || b.length === 0) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    await unsubA();
    await unsubB();
  });
});
