import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import type { WebSocket } from "ws";
import { createEventBus, Topics, type EventBus } from "@sportsfacts/event-bus";
import type { GameEvent, Fact } from "@sportsfacts/shared-types";
import type { GatewayConfig } from "./config.js";
import { loadNormalizedMatch, type NormalizedMatch } from "./matchData.js";
import { ReplayEngine } from "./replayEngine.js";
import { createFactGenerator, type FactGenerator } from "./facts/index.js";
import type { ReplayState, ServerMessage, Snapshot } from "./wsEnvelope.js";

const RECENT_EVENTS = 15;
const RECENT_FACTS = 10;

export interface Gateway {
  app: FastifyInstance;
  replay: ReplayEngine;
  bus: EventBus;
  factGenerator: FactGenerator;
  close: () => Promise<void>;
}

export async function buildGateway(config: GatewayConfig): Promise<Gateway> {
  const match: NormalizedMatch = await loadNormalizedMatch(config.dataFile);
  const bus = createEventBus(
    config.redisUrl,
    config.kafkaBrokers,
    config.kafkaClientId,
    config.kafkaGroupId,
  );
  const factGenerator = await createFactGenerator(match.meta, match.history, {
    aiServiceUrl: config.aiServiceUrl,
  });
  // Clear any stale per-match state in a remote agent before we start.
  factGenerator.reset();

  const clients = new Set<WebSocket>();
  const recentEvents: GameEvent[] = [];
  const recentFacts: Fact[] = [];
  let latestState: ReplayState;

  const broadcast = (msg: ServerMessage): void => {
    const payload = JSON.stringify(msg);
    for (const socket of clients) {
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  };

  const replay = new ReplayEngine(match.events, bus, {
    speed: config.defaultSpeed,
    onState: (state) => {
      latestState = state;
      broadcast({ kind: "state", data: state });
    },
    onReset: () => {
      factGenerator.reset();
      recentEvents.length = 0;
      recentFacts.length = 0;
    },
  });
  latestState = replay.getState();

  // events → fact generation + client fan-out
  await bus.subscribe<GameEvent>(Topics.events, async (event) => {
    recentEvents.push(event);
    if (recentEvents.length > RECENT_EVENTS) recentEvents.shift();
    broadcast({ kind: "event", data: event });
    const facts = await factGenerator.onEvent(event);
    for (const fact of facts) await bus.publish(Topics.facts, fact);
  });

  // facts → client fan-out
  await bus.subscribe<Fact>(Topics.facts, async (fact) => {
    recentFacts.push(fact);
    if (recentFacts.length > RECENT_FACTS) recentFacts.shift();
    broadcast({ kind: "fact", data: fact });
  });

  const app = Fastify({ logger: { level: "warn" } });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get("/health", async () => ({
    status: "ok",
    factGenerator: factGenerator.name,
    bus: config.kafkaBrokers ? "kafka" : config.redisUrl ? "redis" : "in-memory",
    events: match.events.length,
  }));

  app.get("/api/match", async () => match.meta);
  app.get("/api/state", async () => latestState);

  app.post("/api/replay/start", async () => {
    replay.start();
    return latestState;
  });
  app.post("/api/replay/pause", async () => {
    replay.pause();
    return latestState;
  });
  app.post<{ Body: { speed?: number } }>("/api/replay/speed", async (req) => {
    if (typeof req.body?.speed === "number") replay.setSpeed(req.body.speed);
    return latestState;
  });
  app.post<{ Body: { minute?: number } }>("/api/replay/seek", async (req) => {
    if (typeof req.body?.minute === "number") replay.seek(req.body.minute);
    return latestState;
  });

  app.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket: WebSocket) => {
      clients.add(socket);
      const snapshot: Snapshot = {
        meta: match.meta,
        state: latestState,
        recentEvents: [...recentEvents],
        recentFacts: [...recentFacts],
      };
      socket.send(JSON.stringify({ kind: "snapshot", data: snapshot }));
      socket.on("close", () => clients.delete(socket));
      socket.on("error", () => clients.delete(socket));
    });
  });

  const close = async (): Promise<void> => {
    replay.stop();
    await app.close();
    await bus.close();
  };

  return { app, replay, bus, factGenerator, close };
}
