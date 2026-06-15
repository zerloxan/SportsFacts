## 1. Python service scaffolding

- [x] 1.1 Add `langgraph`, `langchain-anthropic`, `langchain-core`, `httpx` (and dev `pytest`) to `apps/ai-service/pyproject.toml`
- [x] 1.2 Create a venv and install the service (editable) so it runs locally
- [x] 1.3 Add `app/` package layout: `main.py`, `config.py`, `schemas.py`, `store.py`, `state.py`, `tools.py`, `agent.py`

## 2. Contracts and stats store

- [x] 2.1 Pydantic models mirroring `GameEvent` and `Fact` (with required `evidence`)
- [x] 2.2 `StatsStore` loading `data/normalized/<match>.json` (history table + meta)
- [x] 2.3 `MatchState` tracking score + per-player in-match goals/timings, with reset

## 3. LangGraph agent

- [x] 3.1 Tools: `query_player_tournament_goals`, `query_in_match_state`, `query_records`, `emit_fact` (evidence required)
- [x] 3.2 Build the `StateGraph`: `prefilter → agent ⇄ tools`, conditional edges, fact collection in state
- [x] 3.3 System prompt: act as a commentary fact engine; must call tools to verify before asserting records/firsts
- [x] 3.4 `ChatAnthropic` (`claude-sonnet-4-6`, temperature 0) bound to tools; readiness based on `ANTHROPIC_API_KEY`

## 4. FastAPI endpoints

- [x] 4.1 `GET /health` → `{ status, ready, model }`
- [x] 4.2 `POST /events` → run state update + agent for fact-worthy events; return validated `Fact[]`
- [x] 4.3 `POST /reset` → clear match state

## 5. Gateway integration

- [x] 5.1 Add `HttpFactGenerator` (calls AI service `/events` and `/reset`) in `apps/gateway`
- [x] 5.2 Update `createFactGenerator`: use HTTP agent when `AI_SERVICE_URL` set and `/health` ready; else deterministic (log the choice)
- [x] 5.3 Gateway validates each returned fact against the Zod `Fact` schema; drop invalid

## 6. Tests and verification

- [x] 6.1 Python: graph/tool tests with a mocked chat model (fact-worthy goal → emits evidence-backed fact; routine event → no model call)
- [x] 6.2 Python: agent `/events` path returns evidence-backed fact; `/health` reports readiness; fact requires evidence
- [x] 6.3 Gateway: `HttpFactGenerator` maps the service response to `Fact[]` and falls back when unreachable
- [x] 6.4 Lint/format Python (ruff) and TS; `pnpm build/lint/typecheck/test` stay green
- [x] 6.5 Without a key: verified the gateway probes `/health` and falls back to deterministic (live-key dashboard run pending a user-supplied `ANTHROPIC_API_KEY`; agent path proven via tests)
- [x] 6.6 Update README + `.env.example` with the AI-service run instructions
