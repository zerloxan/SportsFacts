## 1. Broker

- [x] 1.1 Add a single-node **Redpanda** service (Kafka API on 9092) to `docker-compose.yml`
- [x] 1.2 (optional) Add the Redpanda console for inspection
- [x] 1.3 Verify `docker compose up -d redpanda` comes up healthy

## 2. KafkaEventBus

- [x] 2.1 Add `kafkajs` to `packages/event-bus`
- [x] 2.2 Implement `KafkaEventBus` (shared producer; `subscribe` → consumer group; JSON encode/decode)
- [x] 2.3 Auto-provision `game.events` / `game.facts` topics via the admin client on init
- [x] 2.4 Lazy producer connect; `subscribe` awaits consumer connect; `close()` disconnects all

## 3. Factory + config

- [x] 3.1 Update `createEventBus()` selection precedence: `KAFKA_BROKERS` → `REDIS_URL` → in-memory
- [x] 3.2 Parse `KAFKA_BROKERS` (comma-separated), `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`
- [x] 3.3 Gateway `/health` reports `bus: "kafka" | "redis" | "in-memory"` (already derives from config — extend)

## 4. Tests and docs

- [x] 4.1 Unit-test factory selection (Kafka chosen when `KAFKA_BROKERS` set; precedence over Redis)
- [x] 4.2 Integration round-trip test against a broker, **skipped** when `KAFKA_BROKERS` unset/unreachable
- [x] 4.3 `.env.example` + README: `KAFKA_BROKERS` switch and local Redpanda workflow
- [x] 4.4 `pnpm build/lint/typecheck/test` green

## 5. Verification

- [x] 5.1 Start Redpanda; run gateway with `KAFKA_BROKERS=localhost:9092`; confirm `/health` shows the Kafka bus
- [x] 5.2 Replay a match; confirm the dashboard streams events + facts via Kafka
- [x] 5.3 Inspect the broker (`rpk topic consume game.events`) to prove messages flow through Kafka
