## Context

The agent verifies facts against a curated history table baked into the normalized artifact. This change makes the verification real: a Postgres stats DB holding the StatsBomb 2022 World Cup, queried live by the agent. Postgres is available now (Docker up). The schema/migrations/ingestion live on the TS side (Drizzle, the interview-relevant ORM); the Python agent reads via `asyncpg` raw SQL.

## Goals / Non-Goals

**Goals:**
- A real, queryable stats DB (matches, players, goals) loaded from StatsBomb open data.
- The agent's tournament-tally tool counts goals from the DB with a correct "before this match" cutoff.
- Keep the no-Docker path working: file store remains the default when `DATABASE_URL` is unset.
- Idempotent ingestion (safe to re-run).

**Non-Goals:**
- Ingesting every event type (only what verification needs: goals; plus matches/players). A full event table can come later.
- Moving in-match running state to the DB (it stays in the service — it's live, not historical).
- Multi-competition support beyond the WC2022 corpus.

## Decisions

- **Lean schema: `matches`, `players`, `goals`.** Goals (not all events) is what the tally query needs, and keeps ingestion fast (~170 goals across 64 matches vs. ~220k raw events). `goals` carries `match_id`, `player_id`, `team_id/name`, `minute`, `period`, `penalty`, `own_goal`, `shootout`. The cutoff query joins `goals → matches` and filters `matches.match_date < :currentDate` and same competition/season, excluding shootout goals.
- **Drizzle (TS) owns schema + migrations + ingestion; Python reads with `asyncpg`.** Standard split: one source of truth for DDL, queries where they're needed. Python issues a single parameterized COUNT query — no ORM needed on that side.
- **Ingestion is idempotent via upserts on natural keys** (`matches.match_id`, `players.player_id`, `goals` on `statsbomb_event_id`). Re-running refreshes without duplicates.
- **`postgres` (postgres.js) as the Drizzle driver** — lightweight, good DX.
- **Store selection in the service**: a `StatsStore` protocol with `FileStatsStore` (existing) and `PostgresStatsStore` (new). `query_player_tournament_goals` calls `store.player_tournament_goals(player_id, match_id)`; the Postgres impl runs the cutoff COUNT, the file impl returns the curated number. Evidence records `source` = `statsbomb-postgres` vs `curated-history`.
- **Match date cutoff** uses `matches.match_date` (StatsBomb provides it). The current match's id/date comes from the service's loaded meta.

## Risks / Trade-offs

- **64 match-event downloads (~100MB)** → Stream/iterate with a small concurrency limit and progress logging; only goals are retained in memory per match. One-time cost.
- **Contract drift (TS DDL vs Python SQL)** → Keep the Python query minimal and pinned to the column names; a smoke query in the ingestion verifies counts. Add an integration check.
- **Player-name variations across files** → Upsert players by `player_id` (stable), store the longmost-recent name; nicknames stay in the curated table for display.
- **Postgres unavailable** → `DATABASE_URL` unset ⇒ file store; the demo never hard-depends on the DB.

## Migration Plan

`docker compose up -d` → generate + apply Drizzle migrations → run ingestion → set `DATABASE_URL` for the AI service → verify the agent's tally matches a direct SQL `COUNT`. Rollback: unset `DATABASE_URL` (agent reverts to the file store); drop the tables.

## Open Questions

- Whether to expand `goals` into a general `events` table later for richer tools (assists, shots-on-target streaks) — deferred.
- Whether to precompute a `player_tournament_goals` materialized view vs. counting on the fly — on-the-fly is fine at this scale.
