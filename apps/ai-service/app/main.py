"""FastAPI surface for the AI fact-generation service.

The gateway calls `POST /events` for each match event and `POST /reset` on
replay restart/seek. `GET /health` reports whether Claude is live so the gateway
can fall back to its deterministic generator when no API key is configured.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI
from pydantic import ValidationError

from .agent import run_agent
from .config import Config, load_config
from .schemas import (
    EventRequest,
    Fact,
    FactsResponse,
    Health,
    ResetRequest,
)
from .state import MatchState
from .store import StatsStore

logging.basicConfig(level=logging.INFO)


def create_model(cfg: Config) -> Any:
    """Create the Claude chat model, or None when no API key is configured."""
    if not cfg.ready:
        return None
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model=cfg.model,
        temperature=0,
        max_tokens=1024,
        api_key=cfg.api_key,
    )


def create_tally(cfg: Config, store: StatsStore) -> Any:
    """Postgres-backed tally when DATABASE_URL is set and the match is in the DB,
    else None (the agent falls back to the file store's curated tally)."""
    if not cfg.database_url:
        return None
    try:
        from .pgstore import PgTally

        return PgTally(cfg.database_url, int(store.meta["matchId"]))
    except Exception as exc:  # noqa: BLE001
        logging.getLogger("ai-service").warning(
            "Postgres tally unavailable (%s) — using file store", exc
        )
        return None


def create_app(
    cfg: Config | None = None, model: Any = "default", tally: Any = "default"
) -> FastAPI:
    cfg = cfg or load_config()
    store = StatsStore.from_file(cfg.data_file)
    chat_model = create_model(cfg) if model == "default" else model
    pg_tally = create_tally(cfg, store) if tally == "default" else tally
    states: dict[str, MatchState] = {}

    app = FastAPI(title="SportsFacts AI service")

    def state_for(match_id: str) -> MatchState:
        return states.setdefault(match_id, MatchState())

    @app.get("/health", response_model=Health)
    def health() -> Health:
        return Health(
            status="ok",
            ready=chat_model is not None,
            model=cfg.model,
            statsStore="postgres" if pg_tally is not None else "file",
        )

    @app.post("/events", response_model=FactsResponse)
    def events(req: EventRequest) -> FactsResponse:
        event = req.event
        state = state_for(event.matchId)
        state.update(event)

        if chat_model is None or not state.is_fact_worthy(event):
            return FactsResponse(facts=[], generator="ai-fact-agent (idle)")

        try:
            raw = run_agent(chat_model, store, state, event, pg_tally)
        except Exception as exc:  # noqa: BLE001 - never break the live stream
            # e.g. billing / rate-limit / transient API errors. Degrade to no
            # facts rather than 500 so the gateway keeps streaming.
            logging.getLogger("ai-service").warning(
                "agent run failed (%s): %s", type(exc).__name__, exc
            )
            return FactsResponse(
                facts=[], generator=f"langgraph-claude (error: {type(exc).__name__})"
            )

        facts: list[Fact] = []
        for d in raw:
            try:
                facts.append(Fact.model_validate(d))
            except ValidationError as exc:
                # Drop anything that doesn't satisfy the contract — but log why.
                logging.getLogger("ai-service").warning(
                    "dropped fact failing contract: %s | dict=%s",
                    exc.errors(),
                    d,
                )
                continue
        return FactsResponse(facts=facts, generator="langgraph-claude")

    @app.post("/reset")
    def reset(req: ResetRequest) -> dict[str, str]:
        states.pop(req.matchId, None)
        return {"status": "reset", "matchId": req.matchId}

    return app


app = create_app()
