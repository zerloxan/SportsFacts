"""Verification tools the agent calls before asserting facts. They query the
stats store (history) and the live match state. `emit_fact` is the only way to
produce a fact and it *requires* evidence, enforcing verify-before-assert.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from langchain_core.tools import StructuredTool, tool

from .schemas import FactCategory
from .state import MatchState
from .store import StatsStore


def build_tools(
    store: StatsStore,
    state: MatchState,
    collector: list[dict[str, Any]],
    match_id: str,
    event_id: str,
    tally: Any | None = None,
) -> list[StructuredTool]:
    @tool
    def query_player_tournament_goals(player_id: int) -> str:
        """Return how many goals a player scored BEFORE this match (their
        pre-match tournament tally). Use to compute an updated total."""
        # Prefer the Postgres-backed tally when available; else the file store.
        rec = tally.lookup(player_id) if tally is not None else None
        if rec is None and tally is None:
            rec = store.player_tournament_goals(player_id)
            if rec is not None:
                rec = {**rec, "source": "curated-history"}
        if rec is None:
            return json.dumps({"found": False, "player_id": player_id})
        return json.dumps({"found": True, **rec})

    @tool
    def query_in_match_state(player_id: int) -> str:
        """Return a player's running state in THIS match: goals scored so far,
        the minutes they scored, and seconds between their last two goals."""
        return json.dumps(state.player_in_match(player_id))

    @tool
    def query_records(topic: str) -> str:
        """Search curated historical records by keyword (e.g. 'hat-trick',
        'golden-boot'). Returns matching record rows to cite as evidence."""
        return json.dumps(store.records(topic))

    @tool
    def emit_fact(
        text: str,
        category: FactCategory,
        confidence: float,
        evidence_description: str,
        evidence_query: str,
        evidence_result: str,
        evidence_source: str,
    ) -> str:
        """Emit ONE broadcast-ready fact. Only call this AFTER verifying the
        claim with a query tool. `evidence_*` must describe the data that backs
        the claim (evidence is mandatory).

        `category` MUST be exactly one of: milestone, record, streak, first,
        head_to_head, rarity, context. `confidence` is 0.0-1.0."""
        try:
            parsed_result: Any = json.loads(evidence_result)
        except (json.JSONDecodeError, TypeError):
            parsed_result = evidence_result
        collector.append(
            {
                "id": str(uuid4()),
                "matchId": match_id,
                "eventId": event_id,
                "text": text,
                "category": category,
                "confidence": confidence,
                "evidence": {
                    "description": evidence_description,
                    "query": evidence_query,
                    "result": parsed_result,
                    "source": evidence_source,
                },
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
        )
        return "fact recorded"

    return [
        query_player_tournament_goals,
        query_in_match_state,
        query_records,
        emit_fact,
    ]
