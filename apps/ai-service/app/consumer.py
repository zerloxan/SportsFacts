"""Kafka-native ingestion: consume `game.events`, run the agent, publish
validated facts to `game.facts` — no gateway HTTP call in the loop.

`handle_message` is the testable unit (no broker needed); `KafkaFactConsumer`
wraps it with the actual `aiokafka` consumer/producer lifecycle for wiring
into the FastAPI `lifespan`.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

from pydantic import ValidationError

from .agent import run_agent
from .config import Config
from .schemas import Fact, GameEvent
from .state import MatchState
from .store import StatsStore

GAME_EVENTS_TOPIC = "game.events"
GAME_FACTS_TOPIC = "game.facts"

logger = logging.getLogger("ai-service.consumer")


@dataclass
class ConsumerMetrics:
    """In-process counters for the Kafka consume loop, exposed via `GET /metrics`."""

    messages_processed: int = field(default=0)
    facts_published: int = field(default=0)
    errors: int = field(default=0)

    def as_dict(self) -> dict[str, int]:
        return {
            "kafka_messages_processed": self.messages_processed,
            "kafka_facts_published_total": self.facts_published,
            "kafka_consumer_errors_total": self.errors,
        }


class FactProducer(Protocol):
    async def send_and_wait(self, topic: str, value: bytes) -> Any: ...


async def handle_message(
    raw: bytes,
    *,
    chat_model: Any,
    store: StatsStore,
    pg_tally: Any,
    states: dict[str, MatchState],
    producer: FactProducer,
    metrics: ConsumerMetrics | None = None,
) -> None:
    """Process one `game.events` message: update state, run the agent if
    fact-worthy, and publish each validated fact to `game.facts`."""
    if metrics is not None:
        metrics.messages_processed += 1

    event = GameEvent.model_validate_json(raw)
    state = states.setdefault(event.matchId, MatchState())

    if event.type == "kickoff":
        state.reset()
    state.update(event)

    if chat_model is None or not state.is_fact_worthy(event):
        return

    raw_facts = await asyncio.to_thread(run_agent, chat_model, store, state, event, pg_tally)
    for d in raw_facts:
        try:
            fact = Fact.model_validate(d)
        except ValidationError as exc:
            logger.warning("dropped fact failing contract: %s | dict=%s", exc.errors(), d)
            continue
        await producer.send_and_wait(GAME_FACTS_TOPIC, fact.model_dump_json().encode())
        if metrics is not None:
            metrics.facts_published += 1


class KafkaFactConsumer:
    """Owns the `aiokafka` consumer/producer lifecycle for the AI service."""

    def __init__(
        self,
        cfg: Config,
        chat_model: Any,
        store: StatsStore,
        pg_tally: Any,
        states: dict[str, MatchState],
    ) -> None:
        self._cfg = cfg
        self._chat_model = chat_model
        self._store = store
        self._pg_tally = pg_tally
        self._states = states
        self._consumer: Any = None
        self._producer: Any = None
        self._task: asyncio.Task[None] | None = None
        self.metrics = ConsumerMetrics()

    async def start(self) -> None:
        from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

        brokers = self._cfg.kafka_brokers
        self._consumer = AIOKafkaConsumer(
            GAME_EVENTS_TOPIC,
            bootstrap_servers=brokers,
            group_id=self._cfg.kafka_group_id,
            auto_offset_reset="latest",
        )
        self._producer = AIOKafkaProducer(bootstrap_servers=brokers)
        await self._consumer.start()
        await self._producer.start()
        self._task = asyncio.create_task(self._run())
        logger.info(
            "Kafka consumer started (brokers=%s, group=%s); consumer group "
            "rebalancing — first fact may be delayed a second or two",
            brokers,
            self._cfg.kafka_group_id,
        )

    async def _run(self) -> None:
        assert self._consumer is not None
        async for msg in self._consumer:
            try:
                await handle_message(
                    msg.value,
                    chat_model=self._chat_model,
                    store=self._store,
                    pg_tally=self._pg_tally,
                    states=self._states,
                    producer=self._producer,
                    metrics=self.metrics,
                )
            except Exception as exc:  # noqa: BLE001 - never break the consume loop
                self.metrics.errors += 1
                logger.warning("event handling failed (%s): %s", type(exc).__name__, exc)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        if self._consumer is not None:
            await self._consumer.stop()
        if self._producer is not None:
            await self._producer.stop()
