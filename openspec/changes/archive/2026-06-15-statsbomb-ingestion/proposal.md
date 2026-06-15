## Why

The agent currently verifies "tournament goal" facts against a small **curated** history table hand-written in the normalizer. That's a stand-in. The real design is to verify against an actual stats database. This change ingests the StatsBomb 2022 World Cup corpus into Postgres and points the agent's verification tools at real SQL, so a claim like "Messi's 6th of the tournament" is counted from every prior match — not a hardcoded number.

## What Changes

- Define a **Drizzle (Postgres) schema** in `packages/db`: `matches`, `players`, and `goals`, with migrations.
- Add an **ingestion script** that downloads the WC2022 matches + their event files from StatsBomb open data and loads matches, players, and goals into Postgres (idempotent upserts).
- Add a **Postgres-backed stats store** to the Python AI service (`asyncpg`), exposing the same query surface as the file store: tournament-goals-before-this-match counted from the DB.
- Make the service **select the store by configuration**: Postgres when `DATABASE_URL` is set, otherwise the existing file-based store (so the no-Docker demo still works).
- Update the `query_player_tournament_goals` tool to return DB-sourced tallies (with the match-date cutoff), keeping the evidence contract.
- Document the ingestion step and the `DATABASE_URL` switch.

## Capabilities

### New Capabilities
- `stats-database`: A Postgres schema (matches, players, goals) + an idempotent StatsBomb ingestion pipeline that becomes the agent's queryable stats DB.

### Modified Capabilities
- `ai-fact-agent`: The agent's tournament-tally verification tool reads from Postgres (when `DATABASE_URL` is set) instead of the curated file table; behavior is otherwise unchanged, and it falls back to the file store without a DB.

## Impact

- New schema + migrations + ingestion in `packages/db`; new Postgres store + store-selection in `apps/ai-service`.
- New deps: TS — `drizzle-orm`, `drizzle-kit`, `postgres` (driver); Python — `asyncpg` (already pinned) / `psycopg`.
- Requires Postgres running (`docker compose up -d`). `DATABASE_URL` already documented in `.env.example`.
- Depends on `ai-fact-agent` (the tool + store-selection seam) and `monorepo-scaffold` (`packages/db`).
