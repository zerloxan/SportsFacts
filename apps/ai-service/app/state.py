"""Per-match running state, updated as events arrive. This is the verifiable
'live stats DB' the agent queries via the `query_in_match_state` tool.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .schemas import GameEvent


@dataclass
class GoalMark:
    player_id: int
    minute: int
    offset_ms: int


@dataclass
class MatchState:
    score: dict[str, int] = field(default_factory=lambda: {"home": 0, "away": 0})
    in_match_goals: dict[int, int] = field(default_factory=dict)
    goal_log: list[GoalMark] = field(default_factory=list)

    def reset(self) -> None:
        self.score = {"home": 0, "away": 0}
        self.in_match_goals.clear()
        self.goal_log.clear()

    def is_fact_worthy(self, event: GameEvent) -> bool:
        if event.type == "goal":
            return not bool(event.details.get("shootout"))
        if event.type == "card" and event.details.get("card") == "red":
            return True
        return False

    def update(self, event: GameEvent) -> None:
        """Apply an event to running state. Call before running the agent."""
        if event.type != "goal" or event.details.get("shootout"):
            return
        score_after = event.details.get("scoreAfter")
        if isinstance(score_after, dict):
            self.score = {
                "home": int(score_after.get("home", self.score["home"])),
                "away": int(score_after.get("away", self.score["away"])),
            }
        if event.player is not None:
            pid = event.player.id
            self.in_match_goals[pid] = self.in_match_goals.get(pid, 0) + 1
            self.goal_log.append(GoalMark(pid, event.minute, event.timelineOffsetMs))

    def player_in_match(self, player_id: int) -> dict[str, Any]:
        goals = [g for g in self.goal_log if g.player_id == player_id]
        gap = None
        if len(goals) >= 2:
            gap = round((goals[-1].offset_ms - goals[-2].offset_ms) / 1000)
        return {
            "inMatchGoals": self.in_match_goals.get(player_id, 0),
            "minutes": [g.minute for g in goals],
            "secondsBetweenLastTwo": gap,
        }
