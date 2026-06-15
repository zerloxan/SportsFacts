## Why

Today's facts come from a deterministic TypeScript generator — accurate, but hand-written. The whole point of SportsFacts is an **AI agent that reasons over data and verifies a claim before asserting it**. This change introduces the real thing: a Python service running a **LangGraph** tool-use agent backed by **Claude**, which queries a stats store via tools and only emits facts it has verified. It runs Docker-free (the gateway calls it over HTTP) and degrades gracefully to the deterministic generator when no API key is present.

## What Changes

- Implement the Python **AI service** (`apps/ai-service`) with FastAPI + **LangGraph** + `langchain-anthropic`.
- Build an explicit LangGraph **StateGraph**: a fact-worthiness pre-filter → an agent node (Claude) → a tool node (stats queries) looping until the agent emits verified facts.
- Provide **verification tools** over a stats store loaded from the normalized match artifact: `query_player_tournament_goals`, `query_in_match_state`, `query_records`, and an `emit_fact` tool that *requires* evidence (so the agent cannot assert a fact without it).
- Maintain per-match running state in the service (score, per-player goals/timings) updated as events arrive; expose a reset.
- Expose endpoints: `POST /events` (returns facts for an event), `POST /reset`, `GET /health` (reports whether Claude is live).
- Add an `HttpFactGenerator` to the **gateway** that routes events to the AI service when `AI_SERVICE_URL` is configured and the service reports ready; otherwise the gateway keeps using the deterministic generator.
- Pin the model to `claude-sonnet-4-6` (hot path) via `ANTHROPIC_MODEL`.

## Capabilities

### New Capabilities
- `ai-fact-agent`: A Claude + LangGraph tool-use agent (Python service) that generates evidence-backed facts by querying a stats store, plus the gateway's HTTP routing and graceful fallback to the deterministic generator.

### Modified Capabilities
- _(none — additive; the existing `fact-engine` deterministic path remains the default and the fallback.)_

## Impact

- New Python code under `apps/ai-service`; new `HttpFactGenerator` + selection logic in `apps/gateway`.
- New deps (Python): `langgraph`, `langchain-anthropic`, `langchain-core` (plus existing `fastapi`, `uvicorn`, `anthropic`, `pydantic`). Dev: `pytest`, `httpx`.
- New env: `AI_SERVICE_URL` (gateway), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (service).
- No Docker/Postgres required; the stats store reads `data/normalized/<match>.json`. Postgres-backed tools arrive in `statsbomb-ingestion`.
