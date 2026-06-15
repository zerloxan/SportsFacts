from __future__ import annotations

import json

from app.config import load_config
from app.state import MatchState
from app.store import StatsStore
from app.tools import build_tools


class StubTally:
    """Stands in for PgTally: returns a DB-style result for known players."""

    def __init__(self, data: dict[int, int]) -> None:
        self._data = data

    def lookup(self, player_id: int):
        if player_id not in self._data:
            return None
        return {
            "name": f"player-{player_id}",
            "goals": self._data[player_id],
            "source": "statsbomb-postgres",
        }


def _store() -> StatsStore:
    return StatsStore.from_file(load_config().data_file)


def _tool(tools, name):
    return next(t for t in tools if t.name == name)


def test_tally_tool_uses_postgres_source_when_provided() -> None:
    collector: list = []
    tally = StubTally({5503: 5})
    tools = build_tools(_store(), MatchState(), collector, "3869685", "e1", tally)
    out = json.loads(
        _tool(tools, "query_player_tournament_goals").invoke({"player_id": 5503})
    )
    assert out["found"] is True
    assert out["goals"] == 5
    assert out["source"] == "statsbomb-postgres"


def test_tally_tool_reports_not_found_for_unknown_player_with_db() -> None:
    tally = StubTally({5503: 5})
    tools = build_tools(_store(), MatchState(), [], "3869685", "e1", tally)
    out = json.loads(
        _tool(tools, "query_player_tournament_goals").invoke({"player_id": 99999})
    )
    assert out["found"] is False


def test_tally_tool_falls_back_to_file_store_without_db() -> None:
    # No tally → uses the curated file store (Messi id 5503 → 5 goals).
    tools = build_tools(_store(), MatchState(), [], "3869685", "e1", None)
    out = json.loads(
        _tool(tools, "query_player_tournament_goals").invoke({"player_id": 5503})
    )
    assert out["found"] is True
    assert out["source"] == "curated-history"
