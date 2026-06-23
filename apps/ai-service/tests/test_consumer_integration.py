"""Round-trip integration test against a real broker. Skipped unless
KAFKA_BROKERS is set (e.g. `KAFKA_BROKERS=localhost:9092 pytest -q`)."""

from __future__ import annotations

import asyncio
import json
import os
import uuid

import pytest

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS")

pytestmark = pytest.mark.skipif(
    not KAFKA_BROKERS, reason="KAFKA_BROKERS not set — no broker to test against"
)


def test_consumer_round_trip_through_real_broker() -> None:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
    from langchain_core.messages import AIMessage

    from app.config import load_config
    from app.consumer import GAME_EVENTS_TOPIC, GAME_FACTS_TOPIC, KafkaFactConsumer
    from app.schemas import Fact
    from app.store import StatsStore
    from tests.fakes import FakeToolModel

    async def run() -> None:
        cfg = load_config()
        group_id = f"ai-service-test-{uuid.uuid4().hex[:8]}"
        model = FakeToolModel(
            [
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "emit_fact",
                            "args": {
                                "text": "Goal! Round-trip test fact.",
                                "category": "context",
                                "confidence": 0.9,
                                "evidence_description": "test evidence",
                                "evidence_query": "n/a",
                                "evidence_result": "{}",
                                "evidence_source": "test",
                            },
                            "id": "t1",
                        }
                    ],
                ),
                AIMessage(content="done"),
            ]
        )
        consumer_under_test = KafkaFactConsumer(
            cfg=type(cfg)(**{**cfg.__dict__, "kafka_group_id": group_id}),
            chat_model=model,
            store=StatsStore.from_file(cfg.data_file),
            pg_tally=None,
            states={},
        )
        await consumer_under_test.start()

        facts_consumer = AIOKafkaConsumer(
            GAME_FACTS_TOPIC,
            bootstrap_servers=KAFKA_BROKERS,
            group_id=f"sportsfacts-test-{uuid.uuid4().hex[:8]}",
            auto_offset_reset="latest",
        )
        await facts_consumer.start()
        try:
            producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS)
            await producer.start()
            try:
                await asyncio.sleep(1)  # let consumer groups join
                event = {
                    "id": str(uuid.uuid4()),
                    "matchId": "3869685",
                    "sequence": 1,
                    "period": 1,
                    "minute": 1,
                    "second": 0,
                    "timelineOffsetMs": 0,
                    "type": "goal",
                    "team": {"id": 779, "name": "France"},
                    "player": {"id": 3009, "name": "Kylian Mbappé"},
                    "details": {"scoreAfter": {"home": 1, "away": 0}},
                }
                await producer.send_and_wait(
                    GAME_EVENTS_TOPIC, json.dumps(event).encode()
                )
                msg = await asyncio.wait_for(
                    facts_consumer.__anext__(), timeout=10
                )
                fact = Fact.model_validate(json.loads(msg.value))
                assert "round-trip" in fact.text.lower()
            finally:
                await producer.stop()
        finally:
            await facts_consumer.stop()
            await consumer_under_test.stop()

    asyncio.run(run())
