## Why

Today the Python AI service is a passive HTTP responder: the gateway pulls `game.events`, calls the service's `POST /events` for each event, and republishes the returned facts to `game.facts`. The streaming log already runs on Kafka (from `kafka-streaming-swap`), so this HTTP hop is the last thing preventing the AI service from being a true independent microservice. This change lets the AI service **consume `game.events` and produce `game.facts` directly on Kafka** — the documented follow-on from the Kafka swap — turning the gateway into a pure relay and giving the system a real "independent services communicating over a durable log" story.

## What Changes

- Add a **Kafka ingestion mode** to the AI service: when `KAFKA_BROKERS` is set, it subscribes to `game.events` (consumer group `ai-service`), runs the existing LangGraph + Claude agent per event, and publishes validated facts to `game.facts` — no gateway HTTP call in the loop.
- Reset is **driven by the event stream** (a `kickoff` event clears that match's running state) instead of the gateway's `POST /reset`, since the gateway no longer drives the agent in this mode.
- Add a **relay-only mode** to the gateway (`GATEWAY_GENERATE_FACTS=false`): it stops generating facts and becomes a pure fan-out of `game.events` + `game.facts` to WebSocket clients, so facts are produced exactly once (by the AI service) with no double-emission.
- Keep the **HTTP path** (`POST /events`, `/reset`) as the default for the in-memory / Redis demo and for tests. The deterministic gateway generator is unchanged.
- Add the `aiokafka` dependency to the AI service and a skippable broker integration test.

## Capabilities

### New Capabilities
- _(none)_

### Modified Capabilities
- `ai-fact-agent`: gains a Kafka-native ingestion mode — subscribe to `game.events`, run the agent, and publish facts to `game.facts` directly; reset is triggered by a `kickoff` event rather than an HTTP call.
- `realtime-gateway`: gains a relay-only mode that disables gateway-side fact generation so the Kafka-native AI service is the sole fact producer.

## Impact

- New code in `apps/ai-service` (`app/consumer.py` + lifespan wiring in `app/main.py`); new dep `aiokafka`. HTTP endpoints retained.
- `apps/gateway`: a `GATEWAY_GENERATE_FACTS` config flag that makes `buildGateway()` skip the fact-generation subscription; no change to the bus or WebSocket envelope.
- New env: `KAFKA_BROKERS` (already used by the gateway) now also activates the AI service consumer; optional `KAFKA_GROUP_ID` (default `ai-service`); `GATEWAY_GENERATE_FACTS` (default `true`).
- Reuses the existing `game.events` / `game.facts` topics and the shared `GameEvent` / `Fact` contracts — no contract changes. Redis / in-memory paths and the HTTP demo flow are unaffected.
- Depends on `event-bus` (Kafka backend) and `ai-fact-agent` from the streaming spine.
