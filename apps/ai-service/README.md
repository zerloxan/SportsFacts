# ai-service (Python · LangGraph + Claude)

The SportsFacts AI fact-generation agent. A **LangGraph** `StateGraph` runs
**Claude** (`claude-sonnet-4-6`) in a tool-use loop that _verifies_ a claim
against a stats store before asserting it. Every emitted fact carries the
supporting `evidence`.

```
START ──(fact-worthy?)──▶ agent ⇄ tools ──▶ END
```

- **Tools** (`app/tools.py`): `query_player_tournament_goals`,
  `query_in_match_state`, `query_records`, and `emit_fact` (which _requires_
  evidence — the agent can't produce a fact without it).
- **Store** (`app/store.py`): reads `data/normalized/<match>.json` — the
  file-based curated fallback for tournament tallies and records.
- **Postgres tally** (`app/pgstore.py`): when `DATABASE_URL` is set, the
  `query_player_tournament_goals` tool runs a real `COUNT(*)` over the ingested
  StatsBomb `goals` table (with a "before this match" cutoff) and sources
  evidence to `statsbomb-postgres`; otherwise it falls back to the file store.
- **State** (`app/state.py`): per-match running score / per-player goals,
  updated as events arrive.

## Endpoints

| Method | Path      | Purpose                                                          |
| ------ | --------- | ---------------------------------------------------------------- |
| GET    | `/health` | `{ status, ready, model, statsStore }` — `ready` is false without an API key; `statsStore` is `postgres` or `file` |
| POST   | `/events` | `{ event }` → `{ facts, generator }` for one event               |
| POST   | `/reset`  | `{ matchId }` → clear running state                              |

The gateway calls these over HTTP when `AI_SERVICE_URL` is set and `/health`
reports ready; otherwise it uses its deterministic generator.

## Kafka-native mode

When `KAFKA_BROKERS` is set, the service additionally starts a Kafka
consumer/producer (`app/consumer.py`) in the FastAPI `lifespan`: it subscribes
to `game.events` (consumer group `ai-service`, override via `KAFKA_GROUP_ID`,
`auto_offset_reset="latest"`), runs the same agent/state/store used by the
HTTP path, and publishes validated facts directly to `game.facts` — no
gateway HTTP call in the loop. A `kickoff` event on the stream resets that
match's running state (the gateway no longer calls `POST /reset` in this
mode). Run the gateway with `GATEWAY_GENERATE_FACTS=false` alongside this so
facts are produced exactly once. The HTTP endpoints keep working unchanged
either way.

## Run it

```bash
cd apps/ai-service
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # (Scripts → bin on macOS/Linux)

export ANTHROPIC_API_KEY=sk-ant-...               # required for live Claude calls
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Then start the gateway with `AI_SERVICE_URL=http://localhost:8000` and the
dashboard's facts come from the agent.

## Test (no API key / no tokens)

```bash
.venv/Scripts/python -m pytest -q
```

Tests drive the LangGraph graph with a scripted fake model, so the
verify-then-emit behaviour and the `/events` path are proven without calling
Claude.
