## Context

After `kafka-streaming-swap`, the streaming log runs on Kafka (Redpanda locally), but the AI service is still driven over HTTP: the gateway subscribes to `game.events`, calls `POST /events` per event (`HttpFactGenerator`), and republishes the returned facts to `game.facts`. The AI service (`apps/ai-service`, FastAPI) is otherwise self-contained — it owns the agent (`run_agent`, sync), per-match `MatchState`, the file/Postgres stats stores, and graceful degradation. This change makes the AI service subscribe to and produce on Kafka itself, so it becomes an independent consumer of the durable log and the gateway drops out of the fact path.

## Goals / Non-Goals

**Goals:**
- AI service consumes `game.events` and produces `game.facts` on Kafka when `KAFKA_BROKERS` is set, reusing the existing agent, state, and stores unchanged.
- No double-emission of facts: the gateway can run relay-only.
- HTTP `/events` + `/reset` and the deterministic gateway generator remain for the in-memory / Redis demo and tests.
- Resilient consumer loop; reset handled from the stream.

**Non-Goals:**
- Partitioning / running multiple AI-service instances, exactly-once semantics, or a schema registry (single partition, single consumer — same scale as today).
- Removing the HTTP path or changing the agent, tools, stores, or `Fact` / `GameEvent` contracts.
- Moving the gateway's WebSocket/replay responsibilities (it still owns replay and client fan-out).

## Decisions

- **`aiokafka` as the Python client.** Async-native, so the consumer and producer run inside FastAPI's `lifespan` on the existing event loop — no separate thread pool to manage. `confluent-kafka` (librdkafka) is more "production standard" but sync and heavier to wire into an async app; `aiokafka` is the right fit at this scale and is a clean talking point.
- **Run the agent off the event loop.** `run_agent` is synchronous (LangGraph + sync `psycopg`). The consumer loop awaits `asyncio.to_thread(run_agent, ...)` so a multi-second Claude call never blocks polling or the FastAPI server sharing the loop.
- **Activation by `KAFKA_BROKERS`.** Mirrors the gateway's existing selector: brokers set → start consumer + producer in `lifespan`; unset → service behaves exactly as today (HTTP only). One env var drives both services.
- **Stable consumer group `ai-service` (default), latest offset.** A single stable group means each event is processed once (work-sharing, not the gateway's per-subscription fan-out). `auto_offset_reset="latest"` mirrors the TS `fromBeginning: false` so a restart doesn't replay history. Group id overridable via `KAFKA_GROUP_ID`.
- **Reset from the stream via `kickoff`.** The gateway no longer calls `/reset` in this mode, so the consumer clears a match's `MatchState` when it sees a `kickoff` event (replay restarts always begin with one). This keeps the services decoupled — no control topic, no cross-service RPC. `POST /reset` stays for the HTTP path.
- **Gateway relay flag `GATEWAY_GENERATE_FACTS` (default `true`).** When `false`, `buildGateway()` skips constructing the fact generator and the events→facts publish loop, keeping only the events fan-out and the `game.facts`→client subscription. Explicit flag (rather than inferring from `KAFKA_BROKERS`) preserves the deterministic fallback in Kafka mode when you *don't* run the Python consumer, and makes the topology obvious in config.
- **Topics.** Reuse `game.events` / `game.facts`. The local Redpanda runs in `dev-container` mode (auto-creates topics on first produce/subscribe) and the gateway already provisions them, so the Python side does not add an admin client.
- **Graceful degradation preserved.** Producer/consumer connect in `lifespan` startup; a broker that is unreachable is logged and the HTTP server still serves `/health` (which continues to report readiness). Per-event agent errors are caught and logged, never breaking the loop (same posture as the current `/events` handler).

## Risks / Trade-offs

- **At-least-once → rare duplicate facts.** On a consumer restart mid-batch an event could be reprocessed. Each `Fact` already carries a UUID and the dashboard renders a bounded recent list, so impact is cosmetic; dedup is out of scope.
- **`kickoff`-based reset is a heuristic.** If a future feed lacks a kickoff or sends several, reset timing could drift. Acceptable for the StatsBomb replay (always one kickoff per period start); revisit if real feeds are added. A sequence-goes-backwards guard can be added cheaply if needed.
- **Two activation flags to set together.** Running the Kafka-native topology means `KAFKA_BROKERS` (both services) **and** `GATEWAY_GENERATE_FACTS=false`. Misconfiguring (flag left `true`) double-produces facts. Mitigated by documenting the pairing in `.env.example` / README and a gateway startup log line stating the mode.
- **Consumer-group rebalance latency on startup.** First fact may lag a second or two after subscribe; fine for the demo, and matched by reading from latest so no backlog replays.
