"""Loads the normalized match artifact and exposes it as a queryable stats
store. This is the file-based stand-in for the future Postgres stats DB; the
agent's tools query it exactly as they will later query SQL.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class StatsStore:
    def __init__(self, data: dict[str, Any]) -> None:
        self._meta: dict[str, Any] = data["meta"]
        self._history: dict[str, Any] = data["history"]

    @classmethod
    def from_file(cls, path: Path) -> "StatsStore":
        with open(path, encoding="utf-8") as f:
            return cls(json.load(f))

    @property
    def meta(self) -> dict[str, Any]:
        return self._meta

    def nickname(self, player_id: int, fallback: str) -> str:
        return self._history.get("nicknames", {}).get(str(player_id), fallback)

    def player_tournament_goals(self, player_id: int) -> dict[str, Any] | None:
        """Goals scored by a player BEFORE this match (pre-match tally)."""
        return self._history.get("preMatchTournamentGoals", {}).get(str(player_id))

    def records(self, topic: str | None = None) -> list[dict[str, Any]]:
        recs: list[dict[str, Any]] = self._history.get("records", [])
        if topic is None:
            return recs
        t = topic.lower()
        return [
            r
            for r in recs
            if t in r.get("id", "").lower()
            or t in r.get("kind", "").lower()
            or t in r.get("text", "").lower()
        ]
