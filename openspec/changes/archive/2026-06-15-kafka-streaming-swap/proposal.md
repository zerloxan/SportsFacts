## Why

The event/fact stream runs on an in-memory bus by default and Redis Streams when configured. The architecture was built with a swappable `EventBus` seam precisely so the streaming backbone could become a real distributed log. This change delivers that: a **Kafka-compatible** backend (running **Redpanda** locally — single binary, Kafka API, no ZooKeeper/JVM) selected by configuration, with **zero changes to the gateway, replay engine, or AI service**. It upgrades the system's systems-design story to a durable, partitioned, replayable log.

## What Changes

- Add a **`KafkaEventBus`** implementation in `packages/event-bus` (using `kafkajs`) that satisfies the existing `EventBus` interface: topics map to Kafka topics; `subscribe` runs a consumer group reading from the tail.
- Extend **`createEventBus()`** to select the Kafka backend when `KAFKA_BROKERS` is set (precedence: Kafka → Redis → in-memory), so no consumer code changes.
- Add a **Redpanda** service (Kafka API) to `docker-compose.yml`, and ensure the gateway auto-creates the `game.events` / `game.facts` topics on startup.
- Document the `KAFKA_BROKERS` switch and the local Redpanda workflow in `.env.example` and the README.
- Add tests for the factory selection and a Kafka round-trip (skipped when no broker is reachable).

## Capabilities

### New Capabilities
<!-- none -->
- _(none)_

### Modified Capabilities
- `event-bus`: The pub/sub abstraction gains a **Kafka/Redpanda** backend alongside in-memory and Redis, selected by configuration, with consumer-group delivery semantics.

## Impact

- New code in `packages/event-bus` (`kafkaBus.ts`) + factory update; new dep `kafkajs`.
- New `docker-compose.yml` service (Redpanda) and an optional console.
- New env: `KAFKA_BROKERS` (e.g. `localhost:9092`), `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`.
- No changes to `apps/gateway`, `apps/web`, or `apps/ai-service` source — they depend only on the `EventBus` interface. Redis/in-memory paths remain.
- Depends on `event-bus` (the existing seam) from `streaming-spine`.
