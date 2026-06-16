# SportsFacts

Real-time AI sports-commentary fact engine. A recorded soccer match is
**replayed as a live feed**; as each event streams in, a Claude **agent with
tool-use** queries a historical stats database to surface verified,
broadcast-worthy facts ("first time this club has scored 3 first-half goals away
in 50 years"), which appear on a live announcer dashboard.

Built spec-first with [OpenSpec](https://github.com/Fission-AI/OpenSpec).

## Architecture

```
StatsBomb match JSON
        │  (replayed on a timeline)
        ▼
  Replay Engine (TS) ──publish──► EventBus (Kafka / Redis / in-memory)
                                       │ subscribe
                                AI Service (Python) [HTTP call from gateway]
                                Claude + tools ──► Postgres (history)
                                verifies facts  ◄── tool queries
                                       │ publish game.facts
                                  Gateway (TS, Fastify + WS)
                                       │ WebSocket
                                  Next.js dashboard
```

- **Feed:** simulated replay of [StatsBomb Open Data](https://github.com/statsbomb/open-data) — one match replayed live; the rest loaded into Postgres as the historical stats DB the agent mines.
- **Bus:** Kafka/Redpanda (set `KAFKA_BROKERS`), Redis Streams (set `REDIS_URL`), or in-memory (default). Zero code changes to switch — config only.
- **Fact engine:** Claude tool-use agent that verifies facts against the DB before emitting them.

## Tech stack

| Layer                   | Tech                                                      |
| ----------------------- | --------------------------------------------------------- |
| Web                     | Next.js + React + TypeScript, Tailwind, WebSocket/SSE     |
| Gateway + replay engine | Node/TypeScript, Fastify, Zod                             |
| AI service              | Python, FastAPI, Anthropic SDK (Claude)                   |
| Data / bus              | PostgreSQL 16, Kafka/Redpanda, Redis 7 (Streams, fallback) |
| Tooling                 | pnpm + Turborepo monorepo, Docker Compose, GitHub Actions |

## Repository layout

```
apps/
  web/          Next.js announcer dashboard          (announcer-dashboard change)
  gateway/      Fastify gateway + replay engine        (replay-engine / realtime-gateway)
  ai-service/   Python FastAPI Claude agent            (ai-fact-agent change)
packages/
  shared-types/ Zod event + fact contracts (source of truth)
  db/           Drizzle schema + migrations            (statsbomb-ingestion change)
openspec/       Spec-driven change proposals
```

## Prerequisites

- Node.js >= 22, pnpm >= 11
- Docker (for Postgres, Redis, and Redpanda)
- Python >= 3.12 (for the AI service)

## Getting started

```bash
# 1. Install JS dependencies
pnpm install

# 2. Quality gates
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

## Run the live demo

The streaming spine runs with **no external services required** — the in-memory
event bus is the default, and the fact engine is deterministic. Redis, Postgres,
and Claude are opt-in (see below).

```bash
# 1. Build workspace packages (shared-types, event-bus) and generate match data
pnpm build
pnpm --filter @sportsfacts/gateway normalize     # writes data/normalized/3869685.json

# 2. Start everything (gateway on :8787, dashboard on :3000)
pnpm dev
```

Open <http://localhost:3000>. The 2022 World Cup Final (Argentina 3-3 France)
replays as a live feed; the scoreboard moves and **evidence-backed AI facts**
stream in (e.g. _"HAT-TRICK for Mbappé! The first in a men's World Cup final
since Geoff Hurst in 1966"_ — expand "why this is true" to see the supporting
data). Use the speed controls to fast-forward.

### Optional: real AI facts (LangGraph + Claude)

Swap the deterministic generator for the **Python LangGraph agent** that uses
Claude to verify facts via tool calls (see [`apps/ai-service`](apps/ai-service)):

```bash
# 1. Start the AI service (needs an ANTHROPIC_API_KEY — see apps/ai-service/README.md)
cd apps/ai-service
python -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"
export ANTHROPIC_API_KEY=sk-ant-...
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# 2. Point the gateway at it (in another shell), then run the stack
export AI_SERVICE_URL=http://localhost:8000
pnpm dev
```

When `AI_SERVICE_URL` is set and the service reports ready, the gateway routes
facts to the agent; otherwise it falls back to the deterministic generator.

### Optional: Kafka bus (Redpanda)

Run the streaming spine on a real Kafka-compatible distributed log — no ZooKeeper/JVM needed.

```bash
docker compose up -d redpanda              # single-node Redpanda on :9092
export KAFKA_BROKERS=localhost:9092        # gateway auto-provisions topics + switches to Kafka
pnpm dev
```

`GET /health` will report `"bus": "kafka"`. Browse the Redpanda console at
<http://localhost:8080> to inspect topic offsets and confirm messages are flowing.
To verify via CLI: `docker exec sportsfacts-redpanda rpk topic consume game.events`.

`KAFKA_BROKERS` takes precedence over `REDIS_URL` — unset it to revert to Redis
or in-memory with no code changes.

#### Kafka-native AI service (no gateway HTTP hop)

Setting `KAFKA_BROKERS` on the **AI service** too makes it consume `game.events`
and produce `game.facts` directly — an independent microservice over the
durable log, no `POST /events` call in the path:

```bash
docker compose up -d redpanda
export KAFKA_BROKERS=localhost:9092

# AI service: consumes game.events, publishes game.facts
cd apps/ai-service && .venv/Scripts/python -m uvicorn app.main:app --port 8000

# Gateway: relay-only — stops generating facts itself (no double-emission)
cd apps/gateway && GATEWAY_GENERATE_FACTS=false pnpm dev
```

`GET /health` on the gateway reports `"facts": "relay"` in this mode. A
`kickoff` event on the stream resets the AI service's per-match state, so a
replay restart doesn't carry over tallies. Leave `GATEWAY_GENERATE_FACTS`
unset (or `true`) to keep the gateway generating facts itself.

### Optional: Redis bus / Postgres

```bash
cp .env.example .env
docker compose up -d postgres redis        # Postgres + Redis only
export REDIS_URL=redis://localhost:6379    # gateway switches to the Redis Streams bus
```

### Optional: real stats DB (Postgres-backed agent)

Load the StatsBomb 2022 World Cup into Postgres so the agent verifies
tournament tallies against real SQL instead of the curated table:

```bash
docker compose up -d                                   # Postgres
export DATABASE_URL=postgresql://sportsfacts:sportsfacts@localhost:5432/sportsfacts
pnpm --filter @sportsfacts/db db:migrate               # apply Drizzle migrations
pnpm --filter @sportsfacts/db db:ingest                # download + load 64 matches, ~195 goals
```

With `DATABASE_URL` set, the AI service's `query_player_tournament_goals` tool
runs a `COUNT(*)` over the `goals` table (with a "before this match" cutoff), and
fact evidence is sourced to `statsbomb-postgres`. Unset it to fall back to the
file-based curated tally. Check `GET /health` → `"statsStore": "postgres" | "file"`.

## Development workflow (OpenSpec)

Work is proposed before it is built. Each change goes through
**proposal → specs → design → tasks → implement → archive**:

```bash
/opsx:propose "<what you want to build>"   # generate proposal + specs + design + tasks
/opsx:apply                                # implement the tasks
/opsx:archive                              # merge deltas into openspec/specs
```

### Changes

1. `monorepo-scaffold` — foundation, contracts, tooling ✅
2. `streaming-spine` — normalize → event bus → replay engine → fact engine → gateway → live dashboard ✅
3. `ai-fact-agent` — Python LangGraph + Claude tool-use agent (HTTP), deterministic fallback ✅
4. `statsbomb-ingestion` — Postgres stats DB (Drizzle) + agent verifies tallies via real SQL ✅
5. `kafka-streaming-swap` — Kafka/Redpanda backend, zero consumer-code changes ✅
6. `ai-service-kafka-consumer` — AI service consumes/produces directly on Kafka; gateway relay-only mode ✅
7. `auth-and-deploy` — phase 2
