## Context

The scaffold defines contracts and tooling but nothing runs. Docker is unavailable in this environment, so the first runnable slice must stand alone. This change delivers the full streaming spine in TypeScript, runnable via `pnpm dev`, with Redis/Postgres/Claude as optional drop-ins selected by environment variables.

## Goals / Non-Goals

**Goals:**
- One command (`pnpm dev`) brings up gateway + dashboard and replays the 2022 World Cup Final as a live feed.
- Evidence-backed facts appear on screen as events stream — no fabricated records.
- Clean seams: swapping the in-memory bus for Redis, or the deterministic fact generator for Claude, is config-only.

**Non-Goals:**
- Postgres ingestion (file-based JSON stands in for now).
- The Python AI service (the fact-engine interface is built so it can move to Python/Claude later).
- Auth, deployment, multi-match support.

## Decisions

- **File-based stats stand-in over Postgres.** Normalization writes one JSON artifact (events + metadata + historical-facts table) the gateway loads at startup. The `fact-engine` queries this table for evidence exactly as it will later query Postgres — same shape, different source. This unblocks a runnable demo without Docker while preserving the verification-before-assertion design.
- **EventBus interface with in-memory default.** `publish(topic, msg)` / `subscribe(topic, handler)`. In-memory uses an `EventEmitter`; Redis uses Streams + consumer groups. Selected by `REDIS_URL`. The replay engine and fact engine only depend on the interface.
- **Single-process gateway hosts replay + fact engines.** For the demo, the replay engine, fact engine, and WebSocket fan-out run in one Fastify process communicating through the bus. With Redis configured, these can later be split into separate processes with no interface change.
- **Deterministic fact generator as the default.** It maintains running match state (score, per-player goals, timings) and joins against the historical-facts table to emit facts like hat-tricks, rapid-fire goals, and tournament milestones — each with `evidence`. A `ClaudeFactGenerator` implementing the same interface activates when `ANTHROPIC_API_KEY` is set (added fully in the later `ai-fact-agent` change; stubbed to fall back here).
- **Typed WS envelope.** A discriminated union `{ kind: "event" | "fact" | "state" | "snapshot", ... }` so the Next.js client can switch on `kind`. Defined in `apps/gateway` and imported by the web app (or duplicated minimally if cross-app import is awkward).
- **Next.js App Router + a single client component** holding WS state; Tailwind for styling. Keep it dependency-light.

## Risks / Trade-offs

- **Deterministic facts could feel canned** → Drive them from real running state + a curated historical-facts table for the actual final (Mbappé hat-trick, Messi's goals, fastest/late goals), so they read as genuine broadcast facts and demonstrate the evidence mechanism.
- **In-memory bus hides distributed concerns** → Keep the Redis implementation real and tested so the "phase 2" story is credible, even if the demo defaults to in-memory.
- **WS envelope duplicated across apps** → Acceptable; if it drifts, promote it into `packages/shared-types` later.
- **Next.js dev + Fastify dev under one `turbo dev`** → Run both as persistent `dev` tasks; document ports (gateway 8787, web 3000) and CORS.

## Migration Plan

Additive only. New package + new code in existing placeholder apps. Verify by running `pnpm dev` and observing the dashboard. Rollback = revert the change; scaffold remains intact.

## Open Questions

- Whether to promote the WS envelope into `shared-types` now or after the dashboard stabilizes (leaning: after).
- Exact historical-facts table contents — start with facts verifiable from the match itself plus a few well-known tournament records.
