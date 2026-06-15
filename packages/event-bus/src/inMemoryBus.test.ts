import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryEventBus } from "./inMemoryBus.js";

const tick = () => new Promise((r) => setTimeout(r, 10));

test("in-memory bus delivers to subscribers", async () => {
  const bus = new InMemoryEventBus();
  const received: string[] = [];
  await bus.subscribe<string>("game.events", (m) => received.push(m));
  await bus.publish("game.events", "goal");
  await tick();
  assert.deepEqual(received, ["goal"]);
  await bus.close();
});

test("topics are isolated", async () => {
  const bus = new InMemoryEventBus();
  const facts: unknown[] = [];
  await bus.subscribe("game.facts", (m) => facts.push(m));
  await bus.publish("game.events", { type: "shot" });
  await tick();
  assert.equal(facts.length, 0);
  await bus.close();
});

test("unsubscribe stops delivery", async () => {
  const bus = new InMemoryEventBus();
  let count = 0;
  const off = await bus.subscribe("game.events", () => count++);
  await bus.publish("game.events", 1);
  await tick();
  await off();
  await bus.publish("game.events", 2);
  await tick();
  assert.equal(count, 1);
  await bus.close();
});
