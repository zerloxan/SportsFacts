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
  file-based stand-in for the future Postgres stats DB.
- **State** (`app/state.py`): per-match running score / per-player goals,
  updated as events arrive.

## Endpoints

| Method | Path      | Purpose                                                          |
| ------ | --------- | ---------------------------------------------------------------- |
| GET    | `/health` | `{ status, ready, model }` — `ready` is false without an API key |
| POST   | `/events` | `{ event }` → `{ facts, generator }` for one event               |
| POST   | `/reset`  | `{ matchId }` → clear running state                              |

The gateway calls these over HTTP when `AI_SERVICE_URL` is set and `/health`
reports ready; otherwise it uses its deterministic generator.

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
