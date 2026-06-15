## Why

The scaffold gives us contracts and tooling but nothing runs yet. To prove the core idea end-to-end we need the streaming spine: a recorded match replayed as a live feed, flowing through an event bus to a gateway, and rendered on a live announcer dashboard with facts appearing as events arrive. Docker is unavailable in the current environment, so this slice must run with `pnpm dev` alone — no external services required — while keeping Redis/Postgres/Claude as drop-in enhancements.

## What Changes

- Add a **data normalization** step that converts a StatsBomb match JSON into our canonical `GameEvent[]` plus match metadata and a small historical-facts table, written to local JSON the gateway loads (file-based stand-in for the future Postgres stats DB).
- Add an **EventBus** abstraction (`packages/event-bus`) with an in-process implementation (default) and a Redis-Streams implementation behind the same interface (used when `REDIS_URL` is set).
- Implement the **replay engine** in `apps/gateway`: emits normalized events on a wall-clock timeline with adjustable speed, pause, and seek.
- Implement a **fact engine**: a deterministic, evidence-producing generator that derives broadcast-worthy facts from running match state + the historical-facts table (every fact carries `evidence`). An optional Claude-backed generator is used when `ANTHROPIC_API_KEY` is set.
- Implement the **gateway**: Fastify HTTP + WebSocket that fans out events and facts to clients and exposes replay controls.
- Implement a first **announcer dashboard** in `apps/web` (Next.js): live scoreboard, event ticker, streaming fact cards (with their evidence), and replay controls.

## Capabilities

### New Capabilities
- `match-normalization`: Convert raw StatsBomb event JSON into canonical `GameEvent[]` + match metadata + a historical-facts table.
- `event-bus`: A pub/sub abstraction with in-memory and Redis-Streams implementations selected by configuration.
- `replay-engine`: Replay a normalized match as a timed live feed with speed/pause/seek controls.
- `fact-engine`: Generate evidence-backed, broadcast-worthy facts from live events (deterministic default, optional Claude).
- `realtime-gateway`: Fastify WebSocket service that fans out events + facts over one typed message envelope and exposes replay controls.
- `announcer-dashboard`: Next.js live UI showing scoreboard, event ticker, fact cards, and controls.

### Modified Capabilities
<!-- None — the WebSocket envelope is introduced as part of the realtime-gateway capability. -->
- _(none)_

## Impact

- New package `packages/event-bus`; substantial new code in `apps/gateway` and `apps/web`.
- New dependencies: `fastify`, `@fastify/websocket`, `@fastify/cors`, `ioredis` (optional path), `next`, `react`, `react-dom`, `ws`/native WebSocket on the client.
- Depends on `monorepo-scaffold` (shared-types, tooling). Redis, Postgres, and Claude remain optional and documented for later changes.
