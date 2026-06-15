## Context

The deterministic generator proves the pipeline and the evidence contract. This change swaps in the real agent: Claude reasoning over tools, orchestrated by LangGraph, in a Python service. Postgres isn't available (Docker-blocked), and the in-memory event bus doesn't cross process boundaries, so the gateway integrates with the Python service over **HTTP** rather than a shared bus. The agent's stats store reads the same normalized JSON the gateway uses.

## Goals / Non-Goals

**Goals:**
- A genuine LangGraph tool-use agent that verifies facts against data before asserting them.
- Docker-free: gateway → HTTP → Python service; stats from `data/normalized/*.json`.
- Graceful fallback to the deterministic generator when no API key, so the demo always works.
- Mock-tested graph/tools so correctness is provable without spending tokens.

**Non-Goals:**
- Postgres-backed tools (that's `statsbomb-ingestion`).
- Streaming the agent's intermediate tokens to the UI.
- Replacing the deterministic generator (it stays as default + fallback).

## Decisions

- **Explicit LangGraph `StateGraph`, not just `create_react_agent`.** Nodes: `prefilter` (skip non-goal/non-card events), `agent` (Claude bound to tools), `tools` (`ToolNode`), with a conditional edge looping `agent → tools → agent` until the model stops calling tools. This shows real graph construction (the interview-relevant part) while keeping the tool loop standard.
- **`emit_fact` as a tool enforces the evidence contract.** Its schema requires `text`, `category`, `confidence`, and an `evidence` object; emitted facts are captured into graph state. The agent physically cannot return a fact without going through it.
- **Stateful service keyed by `matchId`.** The gateway forwards events in order; the service maintains running state so tools like `query_in_match_state` reflect the live match. Gateway calls `POST /reset` on replay restart/seek (reusing the existing `onReset` hook).
- **HTTP integration over a shared bus.** Avoids needing Redis to bridge the TS and Python processes. The `EventBus` seam is untouched; this is a per-event request/response. With Redis later, the service could instead consume `game.events` directly — documented, not built.
- **Model `claude-sonnet-4-6` via `langchain-anthropic` `ChatAnthropic`.** Sonnet for hot-path latency/cost; configurable via `ANTHROPIC_MODEL`. Low `max_tokens`, `temperature=0` for consistent facts. Pre-filter keeps model calls to ~6 goals per match.
- **Pydantic mirrors of the `Fact`/`GameEvent` contracts.** Hand-kept in sync with `packages/shared-types` (the TS Zod schema remains the source of truth); a generated-types step is a later improvement.

## Risks / Trade-offs

- **Contract drift between Zod (TS) and Pydantic (Py)** → Keep the Pydantic models minimal and validated at the HTTP boundary on both sides (gateway validates the response with Zod); add a contract test later.
- **Latency of a tool-loop per goal** → Acceptable (goals are seconds apart at most at 1x; pre-filter avoids per-pass calls). Use Sonnet, low max_tokens, and `temperature=0`.
- **Agent hallucinating despite tools** → The `emit_fact` evidence requirement + a system prompt that mandates tool calls before record claims; the gateway still validates every returned fact against the Zod `Fact` schema and drops invalid ones.
- **No API key in most dev runs** → `/health` readiness gates the gateway; default (no `AI_SERVICE_URL`) keeps the deterministic path so nothing breaks.

## Migration Plan

Additive. Implement the Python service, add `HttpFactGenerator` + selection in the gateway, document env. Verify: (1) mock-model graph tests pass; (2) with `AI_SERVICE_URL` + a key, the dashboard shows agent-authored facts; (3) without a key, it falls back. Rollback = unset `AI_SERVICE_URL`.

## Open Questions

- Whether to later have the Python service consume `game.events` from Redis directly (true microservice) vs. the current HTTP call — defer to the Kafka/Redis phase.
- Whether to generate Pydantic models from the Zod schema automatically — defer until contracts stabilize.
