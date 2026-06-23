import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { Topics } from "@sportsfacts/event-bus";
import type { Fact, GameEvent } from "@sportsfacts/shared-types";
import { buildGateway } from "./server.js";
import type { GatewayConfig } from "./config.js";

const dataFile = resolve(import.meta.dirname, "../../../data/normalized/3869685.json");

function baseConfig(generateFacts: boolean): GatewayConfig {
  return {
    port: 0,
    host: "127.0.0.1",
    dataFile,
    redisUrl: undefined,
    kafkaBrokers: undefined,
    kafkaClientId: undefined,
    kafkaGroupId: undefined,
    aiServiceUrl: undefined,
    generateFacts,
    defaultSpeed: 60,
    autostart: false,
  };
}

function validFact(): Fact {
  return {
    id: randomUUID(),
    matchId: "3869685",
    eventId: randomUUID(),
    text: "Externally produced fact",
    category: "first",
    confidence: 0.9,
    evidence: {
      description: "test",
      query: "n/a",
      result: {},
      source: "test",
    },
    createdAt: new Date().toISOString(),
  };
}

function goalEvent(): GameEvent {
  return {
    id: randomUUID(),
    matchId: "3869685",
    sequence: 1,
    period: 1,
    minute: 10,
    second: 0,
    timelineOffsetMs: 600_000,
    team: { id: 779, name: "Argentina" },
    player: { id: 5503, name: "Lionel Messi" },
    type: "goal",
    details: { scoreAfter: { home: 1, away: 0 } },
  };
}

test("relay mode (generateFacts: false) does not construct a fact generator and publishes no facts from events", async () => {
  const gateway = await buildGateway(baseConfig(false));
  try {
    assert.equal(gateway.factGenerator, null);

    const publishedFacts: unknown[] = [];
    await gateway.bus.subscribe(Topics.facts, (f) => {
      publishedFacts.push(f);
    });

    await gateway.bus.publish(Topics.events, goalEvent());
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(publishedFacts.length, 0);

    const health = await gateway.app.inject({ method: "GET", url: "/health" });
    assert.equal(health.json().facts, "relay");
  } finally {
    await gateway.close();
  }
});

test("relay mode still forwards externally-produced facts to WebSocket clients", async () => {
  const gateway = await buildGateway(baseConfig(false));
  try {
    await gateway.app.listen({ port: 0, host: "127.0.0.1" });
    const address = gateway.app.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected server to bind to a port");
    }
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);

    const received: { kind: string }[] = [];
    await new Promise<void>((resolveOpen, reject) => {
      ws.on("open", () => resolveOpen());
      ws.on("error", reject);
    });
    ws.on("message", (data) => {
      received.push(JSON.parse(data.toString()));
    });

    await gateway.bus.publish(Topics.facts, validFact());

    const deadline = Date.now() + 2000;
    while (!received.some((m) => m.kind === "fact") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }

    assert.ok(received.some((m) => m.kind === "fact"));
    ws.close();
  } finally {
    await gateway.close();
  }
});

test("default mode (generateFacts unset/true) generates facts as before", async () => {
  const gateway = await buildGateway(baseConfig(true));
  try {
    assert.notEqual(gateway.factGenerator, null);
    const health = await gateway.app.inject({ method: "GET", url: "/health" });
    assert.equal(health.json().facts, "gateway");
  } finally {
    await gateway.close();
  }
});
