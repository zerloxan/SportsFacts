## Context

SportsFacts is a polyglot, multi-service system: a TypeScript web app and real-time gateway, a Python AI service, and shared Postgres + Redis infrastructure. This first change establishes the repository skeleton everything else builds on. No application logic ships here beyond the shared type contracts; the goal is a clean, reproducible foundation with the right seams in place.

## Goals / Non-Goals

**Goals:**
- A pnpm + Turborepo monorepo that cleanly hosts both TypeScript and Python workspaces.
- Shared TypeScript/lint/format config and a single shared-types package as the contract source of truth.
- One-command local infrastructure (Postgres + Redis) via Docker Compose.
- Placeholder workspaces so later changes drop in without restructuring.
- CI scaffold that installs, lints, typechecks, and builds.

**Non-Goals:**
- Implementing the replay engine, gateway runtime, AI agent, ingestion, or UI (each is its own later change).
- Production deployment configuration (later change).
- Introducing Kafka/Redpanda — Redis Streams is the MVP bus; Kafka is a documented phase-2 swap.

## Decisions

- **pnpm + Turborepo over Nx/Lerna.** pnpm workspaces are the de-facto standard for JS monorepos with fast, disk-efficient installs; Turborepo adds task orchestration + caching with minimal config. Nx is more powerful but heavier and more opinionated than this project needs. The Python service lives in the same repo as a non-JS workspace folder (`apps/ai-service`) with its own `pyproject.toml`, orchestrated by Turborepo via shell tasks rather than pnpm dependency resolution.
- **Zod as the contract source of truth.** TypeScript services import schemas + inferred types directly from `packages/shared-types`. The Python service mirrors these contracts with Pydantic models (kept in sync manually for now; a generated-types step is a possible later improvement). Zod gives runtime validation at every service boundary, which matters for a streaming system ingesting external (StatsBomb) data shapes.
- **Docker Compose for infra, services run on host during dev.** Postgres + Redis run in containers; the app services run on the host for fast iteration. This keeps the inner loop quick while making infra reproducible. `.env.example` documents all connection variables.
- **Postgres 16 + Redis 7.** Current stable majors; Redis 7 has mature Streams + consumer groups, which the event bus relies on.

## Risks / Trade-offs

- **Polyglot monorepo friction (TS + Python in one repo)** → Keep the Python workspace self-contained with its own tooling (`pyproject.toml`, virtualenv) and wire it into Turborepo only via coarse shell tasks; do not force it through pnpm.
- **Manual TS/Python contract drift** → Centralize the canonical shape in `packages/shared-types`, document the Pydantic mirror as derived, and add a contract test later; acceptable for MVP.
- **Placeholder workspaces breaking install/CI if malformed** → Each placeholder ships a minimal valid `package.json` (and `pyproject.toml` for the Python app) plus a no-op build/lint script so the task graph stays green.

## Migration Plan

Greenfield repository — no migration. Steps: scaffold root tooling → create packages → create placeholder apps → add Docker Compose + `.env.example` → add CI workflow → verify `pnpm install`, `pnpm lint`, `pnpm typecheck`, and `docker compose up` all succeed. Rollback is simply discarding the change since nothing depends on it yet.

## Open Questions

- Gateway framework: Fastify (lightweight) vs NestJS (more structured) — defaulting to Fastify; revisit in the `realtime-gateway` change if structure is desired.
- Whether to auto-generate Python Pydantic models from Zod (e.g., via JSON Schema) or keep them hand-mirrored — deferred until contracts stabilize.
