from __future__ import annotations

from langchain_core.messages import AIMessage

from app.agent import run_agent
from app.config import load_config
from app.schemas import Fact, GameEvent
from app.state import MatchState
from app.store import StatsStore
from tests.fakes import FakeToolModel


def _store() -> StatsStore:
    return StatsStore.from_file(load_config().data_file)


def _goal(player_id: int = 3009, minute: int = 117) -> GameEvent:
    return GameEvent(
        id="11111111-1111-1111-1111-111111111111",
        matchId="3869685",
        sequence=1,
        period=4,
        minute=minute,
        second=0,
        timelineOffsetMs=minute * 60_000,
        type="goal",
        team={"id": 779, "name": "Argentina"},
        player={"id": player_id, "name": "Kylian Mbappé Lottin"},
        details={"scoreAfter": {"home": 3, "away": 3}, "penalty": True},
    )


def test_agent_verifies_then_emits_evidence_backed_fact() -> None:
    # Scripted: call a query tool, then emit_fact, then stop.
    responses = [
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
                        "text": "HAT-TRICK for Mbappé!",
                        "category": "first",
                        "confidence": 0.97,
                        "evidence_description": "3 goals in this match",
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
    model = FakeToolModel(responses)
    state = MatchState()
    event = _goal()
    state.update(event)

    facts = run_agent(model, _store(), state, event)
    assert len(facts) == 1
    fact = Fact.model_validate(facts[0])  # validates against the contract
    assert "HAT-TRICK" in fact.text
    assert fact.evidence.source == "match-state"
    assert fact.evidence.result == {"inMatchGoals": 3}


def test_routine_event_skips_the_model() -> None:
    model = FakeToolModel([])  # would IndexError if invoked
    state = MatchState()
    routine = GameEvent(
        id="22222222-2222-2222-2222-222222222222",
        matchId="3869685",
        sequence=2,
        period=1,
        minute=5,
        second=0,
        timelineOffsetMs=300_000,
        type="pass",
        team={"id": 779, "name": "Argentina"},
        details={},
    )
    facts = run_agent(model, _store(), state, routine)
    assert facts == []
    assert model.calls == 0
