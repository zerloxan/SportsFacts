## 1. Root workspace tooling

- [x] 1.1 Create root `package.json` with workspace scripts (`lint`, `typecheck`, `build`, `format`, `format:check`) delegating to Turborepo
- [x] 1.2 Add `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- [x] 1.3 Add `turbo.json` with `build`, `lint`, `typecheck` task pipelines
- [x] 1.4 Add shared `tsconfig.base.json` with strict compiler options
- [x] 1.5 Add ESLint + Prettier config and `.gitignore`
- [x] 1.6 Add `.nvmrc`/`engines` pinning Node 22 and pnpm

## 2. Shared packages

- [x] 2.1 Scaffold `packages/shared-types` (package.json, tsconfig extending base, src/index.ts)
- [x] 2.2 Implement Zod game-event schema + inferred type in `packages/shared-types`
- [x] 2.3 Implement Zod fact schema (with required supporting-evidence field) + inferred type
- [x] 2.4 Export both runtime validators and inferred types from the package entry point
- [x] 2.5 Scaffold `packages/db` placeholder (package.json, tsconfig) for the later Drizzle schema

## 3. Placeholder app workspaces

- [x] 3.1 Scaffold `apps/web` placeholder (minimal package.json with no-op build/lint)
- [x] 3.2 Scaffold `apps/gateway` placeholder (minimal package.json with no-op build/lint)
- [x] 3.3 Scaffold `apps/ai-service` placeholder (pyproject.toml + minimal package.json shim for Turborepo tasks)

## 4. Local infrastructure

- [x] 4.1 Add `docker-compose.yml` with Postgres 16 and Redis 7 services and healthchecks
- [x] 4.2 Add `.env.example` documenting Postgres + Redis connection variables
- [x] 4.3 Verify `docker compose up -d` brings both services to healthy (verified: postgres + redis report Up (healthy))

## 5. CI and docs

- [x] 5.1 Add GitHub Actions workflow (install → lint → typecheck → build)
- [x] 5.2 Write root `README.md` (architecture overview, prerequisites, run instructions)

## 6. Verification

- [x] 6.1 Run `pnpm install` and confirm all workspaces resolve with no errors
- [x] 6.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm build` and confirm all pass
- [x] 6.3 Confirm shared-types schemas validate a sample event and reject an invalid one
