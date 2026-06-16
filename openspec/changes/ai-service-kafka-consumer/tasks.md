## 1. Dependencies and config

- [x] 1.1 Add `aiokafka` to `apps/ai-service/pyproject.toml`
- [x] 1.2 Extend `Config`/`load_config` with `kafka_brokers` (from `KAFKA_BROKERS`) and `kafka_group_id` (from `KAFKA_GROUP_ID`, default `ai-service`)

## 2. Kafka consumer/producer in the AI service

- [x] 2.1 Add `app/consumer.py`: an `AIOKafkaConsumer` on `game.events` (group `ai-service`, `auto_offset_reset="latest"`) and a shared `AIOKafkaProducer` for `game.facts`
- [x] 2.2 Per message: parse `GameEvent`, update `MatchState`, and on a `kickoff` event clear that match's state before processing (stream-driven reset)
- [x] 2.3 Run the agent off the loop via `asyncio.to_thread(run_agent, ...)`; validate each result against `Fact` and publish only valid facts to `game.facts` (drop + log invalids)
- [x] 2.4 Wrap per-message handling in try/except so a bad message or agent error is logged and the loop continues
- [x] 2.5 Wire start/stop into FastAPI `lifespan` in `app/main.py`, only when `KAFKA_BROKERS` is set; keep `POST /events` and `POST /reset` working unchanged

## 3. Gateway relay-only mode

- [x] 3.1 Add `generateFacts` to `GatewayConfig` (env `GATEWAY_GENERATE_FACTS`, default `true`)
- [x] 3.2 In `buildGateway()`, when `generateFacts` is false, skip creating the fact generator and the events→facts publish loop; keep events fan-out and the `game.facts`→client subscription
- [x] 3.3 Log the active mode on startup; `/health` reports `facts: "gateway" | "relay"`

## 4. Tests and docs

- [x] 4.1 Unit-test the consumer handler: scripted fake model + fake producer, assert a goal yields a published `Fact` and that `kickoff` resets state (no broker)
- [x] 4.2 Integration test: round-trip a goal event through a real broker to a published fact, **skipped** when `KAFKA_BROKERS` is unset/unreachable
- [x] 4.3 Gateway test: relay-only mode publishes no facts but still forwards `game.facts` to clients
- [x] 4.4 Document the Kafka-native topology in `.env.example` and README (`KAFKA_BROKERS` on both services + `GATEWAY_GENERATE_FACTS=false`); update `apps/ai-service/README.md`
- [x] 4.5 `pnpm build/lint/typecheck/test` green; `pytest -q` green

## 5. Verification

- [ ] 5.1 Start Redpanda; run the AI service with `KAFKA_BROKERS=localhost:9092` and the gateway with `KAFKA_BROKERS=localhost:9092 GATEWAY_GENERATE_FACTS=false`
- [ ] 5.2 Replay the match; confirm facts appear on the dashboard and are produced by the AI service (gateway produces none)
- [ ] 5.3 Inspect `rpk topic consume game.facts` to confirm facts originate from the AI-service consumer path; restart replay and confirm `kickoff` reset prevents tally carry-over
