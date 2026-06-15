## Why

SportsFacts is a real-time AI sports-commentary fact engine that will be built from several cooperating services (a TypeScript web app and real-time gateway, a Python AI service, plus shared data/messaging infrastructure). Before any feature work can begin, the project needs a consistent, reproducible foundation: a polyglot monorepo, shared type contracts, and local infrastructure (Postgres + Redis) that every later change builds on. This is the first change and establishes that foundation.

## What Changes

- Introduce a **pnpm + Turborepo monorepo** with an `apps/` and `packages/` layout.
- Add workspace tooling: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, shared `tsconfig` base, ESLint + Prettier, and `.gitignore`.
- Create placeholder workspaces so later changes can fill them in: `apps/web` (Next.js), `apps/gateway` (Fastify), `apps/ai-service` (Python/FastAPI), `packages/shared-types`, `packages/db`.
- Define the **shared event/fact type contracts** in `packages/shared-types` using Zod (the source of truth shared across services).
- Add **Docker Compose** with Postgres and Redis services and an `.env.example` documenting required configuration.
- Add a root `README.md` describing the architecture, prerequisites, and how to run the stack.
- Add a **GitHub Actions** CI workflow scaffold (install, lint, typecheck, build).

## Capabilities

### New Capabilities
- `dev-environment`: Reproducible local development foundation — monorepo workspace layout, shared tooling/config, and Docker Compose-provisioned Postgres + Redis that every service depends on.
- `shared-contracts`: Canonical Zod-based schemas and TypeScript types for game events and generated facts, shared across the gateway, AI service, and web app.

### Modified Capabilities
<!-- None — this is the first change; no existing specs. -->

## Impact

- Creates the entire initial repository structure (no existing code is modified).
- Establishes dependencies: pnpm, Turborepo, TypeScript, Zod, Docker (Postgres 16, Redis 7).
- All subsequent changes (`statsbomb-ingestion`, `replay-engine`, `realtime-gateway`, `ai-fact-agent`, `announcer-dashboard`) depend on this foundation and the `shared-contracts` types.
