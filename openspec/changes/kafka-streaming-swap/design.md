## Context

The `EventBus` interface (`packages/event-bus`) already abstracts publish/subscribe, with `InMemoryEventBus` (default) and `RedisEventBus` selected by `createEventBus()`. The replay engine, fact engine, and gateway depend only on the interface. This change adds a Kafka backend so the streaming spine runs on a real distributed log, with no consumer changes — the long-promised "phase 2" swap.

## Goals / Non-Goals

**Goals:**
- A `KafkaEventBus` satisfying the existing interface, selected by `KAFKA_BROKERS`.
- Local broker via **Redpanda** (Kafka API) in `docker-compose.yml` — single binary, no ZooKeeper/JVM.
- Topic auto-provisioning so first run "just works".
- Tests + docs; in-memory and Redis paths untouched.

**Non-Goals:**
- Moving the Python AI service to consume `game.events` directly from Kafka (it stays on the HTTP call for now — documented as a natural follow-on).
- Partitioning/scaling strategy, exactly-once semantics, schema registry — out of scope for the swap.
- Removing Redis (it remains a supported backend).

## Decisions

- **Redpanda as the local broker, `kafkajs` as the client.** Redpanda speaks the Kafka API, so the app is genuinely "using Kafka" while avoiding ZooKeeper/JVM. Swapping to a real Kafka image later is just a compose change — the client code is unchanged. Use a single-node Redpanda in dev mode.
- **`KafkaEventBus` maps topics → Kafka topics; `subscribe` → a consumer group.** One shared `Producer`; each `subscribe` creates a `Consumer` with a group id (default `KAFKA_GROUP_ID` + a per-subscription suffix so independent subscribers each get all messages, mirroring the in-memory/Redis fan-out). Consumers read from the latest offset (`fromBeginning: false`) to match live-stream semantics. JSON encode/decode the message value.
- **Selection precedence in `createEventBus()`: Kafka → Redis → in-memory.** `KAFKA_BROKERS` (comma-separated) wins; else `REDIS_URL`; else in-memory. Pure config; no consumer changes.
- **Topic provisioning via the Kafka admin client** on bus init: create `game.events` and `game.facts` if absent (idempotent). Avoids "unknown topic" on first run.
- **Async init.** Kafka producer/consumer `connect()` is async, unlike the synchronous in-memory/Redis constructors. `createEventBus()` stays synchronous and returns the bus immediately; the Kafka producer connects lazily on first `publish`, and `subscribe` awaits consumer connect. This keeps `buildGateway()` unchanged.

## Risks / Trade-offs

- **Per-subscription consumer groups could multiply consumers** → Acceptable at this scale (two topics, a couple of subscribers). Use distinct group ids so each subscriber sees every message (fan-out), matching current behavior.
- **Consumer-group rebalance latency on startup** → The first message may take a second or two after `subscribe`; fine for the demo. Read from latest offset so we don't replay history.
- **Broker unavailable** → `createEventBus()` shouldn't hard-fail at construction; surface connection errors on first publish/subscribe and log clearly. Tests that need a broker are skipped when `KAFKA_BROKERS` is unset/unreachable.
- **Redpanda image footprint** → One extra container; documented as opt-in (`docker compose up -d redpanda`). Default demo still needs nothing.

## Migration Plan

Additive. Add `kafkajs` + `KafkaEventBus` + factory branch; add Redpanda to compose; document `KAFKA_BROKERS`. Verify: start Redpanda, run the gateway with `KAFKA_BROKERS=localhost:9092`, confirm `/health` reports the Kafka bus, watch the dashboard stream, and inspect topic offsets (`rpk topic consume game.events`) to prove messages flow through the broker. Rollback: unset `KAFKA_BROKERS` (reverts to Redis/in-memory).

## Open Questions

- Consumer-group model: per-subscription unique groups (fan-out, chosen) vs. a shared group with partitions (work-sharing) — fan-out matches current semantics; revisit if/when services scale out.
- Whether to have the Python AI service consume `game.events` directly from Kafka (true microservice) — deferred to a follow-on change.
