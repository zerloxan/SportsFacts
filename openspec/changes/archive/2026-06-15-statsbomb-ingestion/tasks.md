## 1. Drizzle schema and migrations

- [ ] 1.1 Add `drizzle-orm`, `postgres`, and dev `drizzle-kit` to `packages/db`
- [ ] 1.2 Define schema: `matches`, `players`, `goals` (FKs, natural-key uniqueness)
- [ ] 1.3 Add `drizzle.config.ts` and a `db:generate` / `db:migrate` script
- [ ] 1.4 Generate and apply migrations against the running Postgres

## 2. Ingestion pipeline

- [ ] 2.1 Add `scripts/ingest-statsbomb.ts` (in packages/db) to fetch WC2022 matches + event files
- [ ] 2.2 Parse and upsert matches, players, and goals (idempotent)
- [ ] 2.3 Run ingestion; verify row counts and a sample tally with SQL

## 3. Postgres-backed store in the AI service

- [ ] 3.1 Add `asyncpg` and a `PostgresStatsStore` implementing the store query surface
- [ ] 3.2 `player_tournament_goals(player_id, match_id)` → COUNT of earlier-match goals (same competition, excl. shootout)
- [ ] 3.3 Select store by `DATABASE_URL`; keep `FileStatsStore` as the default/fallback
- [ ] 3.4 Update `query_player_tournament_goals` tool + evidence `source` to reflect the DB

## 4. Tests and verification

- [ ] 4.1 Python: unit-test the tally cutoff logic with a fake/stub store (before-match filtering)
- [ ] 4.2 TS: ingestion parse test (StatsBomb goal → goals row shape)
- [ ] 4.3 Integration: with Postgres + DATABASE_URL, agent processes Messi's final goal; assert evidence shows a DB-counted tally and the number matches a direct SQL COUNT
- [ ] 4.4 `pnpm build/lint/typecheck/test` + ruff/pytest green; `pnpm format`
- [ ] 4.5 Update README + `.env.example` with the ingestion + `DATABASE_URL` steps
