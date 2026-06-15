from __future__ import annotations

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.config import load_config
from app.main import create_app
from app.schemas import Fact
from tests.fakes import FakeToolModel


def test_health_reports_not_ready_without_model() -> None:
    app = create_app(model=None)
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is False
    assert body["model"] == load_config().model


def test_events_idle_without_model_returns_no_facts() -> None:
    app = create_app(model=None)
    client = TestClient(app)
    res = client.post(
        "/events",
        json={
            "event": {
                "id": "33333333-3333-3333-3333-333333333333",
                "matchId": "3869685",
                "sequence": 1,
                "period": 1,
                "minute": 22,
                "second": 0,
                "timelineOffsetMs": 1_320_000,
                "type": "goal",
                "team": {"id": 779, "name": "Argentina"},
                "player": {"id": 5503, "name": "Lionel Messi"},
                "details": {"scoreAfter": {"home": 1, "away": 0}, "penalty": True},
            }
        },
    )
    assert res.status_code == 200
    assert res.json()["facts"] == []


def test_events_with_agent_returns_evidence_backed_fact() -> None:
    # Inject a scripted fake model: query a tool, then emit_fact, then stop.
    model = FakeToolModel(
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
    app = create_app(model=model)
    client = TestClient(app)
    res = client.post(
        "/events",
        json={
            "event": {
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
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["generator"] == "langgraph-claude"
    assert len(body["facts"]) == 1
    fact = Fact.model_validate(body["facts"][0])
    assert "hat-trick" in fact.text.lower()
    assert fact.evidence.result == {"inMatchGoals": 3}


def test_fact_requires_evidence() -> None:
    # The contract itself rejects a fact without evidence.
    bad = {
        "id": "44444444-4444-4444-4444-444444444444",
        "matchId": "3869685",
        "eventId": "33333333-3333-3333-3333-333333333333",
        "text": "unverified",
        "category": "first",
        "confidence": 0.9,
        "createdAt": "2022-12-18T00:00:00Z",
    }
    try:
        Fact.model_validate(bad)
        raise AssertionError("expected validation to fail without evidence")
    except Exception:
        pass
