from __future__ import annotations

import asyncio
import json

from langchain_core.messages import AIMessage

from app.config import load_config
from app.consumer import GAME_FACTS_TOPIC, handle_message
from app.schemas import Fact
from app.state import MatchState
from app.store import StatsStore
from tests.fakes import FakeToolModel

GOAL_EVENT = {
    "id": "55555555-5555-5555-5555-555555555555",
    "matchId": "3869685",
    "sequence": 1,
    "period": 4,
    "minute": 117,
    "second": 0,
    "timelineOffsetMs": 7_020_000,
    "type": "goal",
    "team": {"id": 779, "name": "France"},
    "player": {"id": 3009, "name": "Kylian Mbappé"},
    "details": {"scoreAfter": {"home": 3, "away": 3}, "penalty": True},
}

KICKOFF_EVENT = {
    "id": "66666666-6666-6666-6666-666666666666",
    "matchId": "3869685",
    "sequence": 1,
    "period": 1,
    "minute": 0,
    "second": 0,
    "timelineOffsetMs": 0,
    "type": "kickoff",
    "team": {"id": 779, "name": "France"},
    "details": {},
}


class FakeProducer:
    def __init__(self) -> None:
        self.sent: list[tuple[str, bytes]] = []

    async def send_and_wait(self, topic: str, value: bytes) -> None:
        self.sent.append((topic, value))


def _store() -> StatsStore:
    return StatsStore.from_file(load_config().data_file)


def _agent_model() -> FakeToolModel:
    return FakeToolModel(
        [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "query_in_match_state",
                        "args": {"player_id": 3009},
                        "id": "t1",
                    }
                ],
            ),
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "emit_fact",
                        "args": {
                            "text": "Mbappé completes his hat-trick!",
                            "category": "first",
                            "confidence": 0.97,
                            "evidence_description": "3 goals this match",
                            "evidence_query": "query_in_match_state(3009)",
                            "evidence_result": '{"inMatchGoals": 3}',
                            "evidence_source": "match-state",
                        },
                        "id": "t2",
                    }
                ],
            ),
            AIMessage(content="done"),
        ]
    )


def test_goal_event_publishes_validated_fact_to_kafka() -> None:
    producer = FakeProducer()
    states: dict[str, MatchState] = {}
    asyncio.run(
        handle_message(
            json.dumps(GOAL_EVENT).encode(),
            chat_model=_agent_model(),
            store=_store(),
            pg_tally=None,
            states=states,
            producer=producer,
        )
    )
    assert len(producer.sent) == 1
    topic, value = producer.sent[0]
    assert topic == GAME_FACTS_TOPIC
    fact = Fact.model_validate(json.loads(value))
    assert "hat-trick" in fact.text.lower()


def test_kickoff_event_resets_match_state() -> None:
    states: dict[str, MatchState] = {"3869685": MatchState()}
    states["3869685"].score = {"home": 2, "away": 1}
    states["3869685"].in_match_goals[3009] = 2

    producer = FakeProducer()
    asyncio.run(
        handle_message(
            json.dumps(KICKOFF_EVENT).encode(),
            chat_model=None,
            store=_store(),
            pg_tally=None,
            states=states,
            producer=producer,
        )
    )

    assert states["3869685"].score == {"home": 0, "away": 0}
    assert states["3869685"].in_match_goals == {}
    assert producer.sent == []
