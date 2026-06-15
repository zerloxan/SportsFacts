"""Postgres-backed tournament-tally lookup. Replaces the curated constant in the
file store with a real COUNT over the StatsBomb `goals` table, applying a
"before this match" cutoff so the tally reflects only earlier tournament games.
Used when `DATABASE_URL` is configured.
"""

from __future__ import annotations

from typing import Any

import psycopg


class PgTally:
    """Per-match tournament-goal tally, counted from Postgres."""

    def __init__(self, database_url: str, match_id: int) -> None:
        self._conn = psycopg.connect(database_url, autocommit=True)
        row = self._conn.execute(
            "SELECT match_date, competition_id, season_id "
            "FROM matches WHERE match_id = %s",
            (match_id,),
        ).fetchone()
        if row is None:
            raise ValueError(f"match {match_id} not found in stats DB")
        self._match_date, self._competition_id, self._season_id = row

    def lookup(self, player_id: int) -> dict[str, Any] | None:
        """Pre-match tournament goals for a player (excludes shootout kicks and
        this match and later). Returns None if the player isn't in the DB."""
        name_row = self._conn.execute(
            "SELECT name FROM players WHERE player_id = %s", (player_id,)
        ).fetchone()
        if name_row is None:
            return None
        count_row = self._conn.execute(
            "SELECT count(*) FROM goals g "
            "JOIN matches m ON g.match_id = m.match_id "
            "WHERE g.player_id = %s AND g.shootout = false "
            "AND m.competition_id = %s AND m.season_id = %s "
            "AND m.match_date < %s",
            (player_id, self._competition_id, self._season_id, self._match_date),
        ).fetchone()
        goals = int(count_row[0]) if count_row else 0
        return {"name": name_row[0], "goals": goals, "source": "statsbomb-postgres"}

    def close(self) -> None:
        self._conn.close()
