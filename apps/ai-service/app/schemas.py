"""Pydantic mirrors of the shared TS/Zod contracts (packages/shared-types).

The Zod schema remains the source of truth; these are kept in sync by hand and
validated at the HTTP boundary. The gateway re-validates returned facts against
the Zod `Fact` schema, so any drift is caught.
"""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

FactCategory = Literal[
    "milestone",
    "record",
    "streak",
    "first",
    "head_to_head",
    "rarity",
    "context",
]


class TeamRef(BaseModel):
    id: int
    name: str


class PlayerRef(BaseModel):
    id: int
    name: str


class GameEvent(BaseModel):
    id: str
    matchId: str
    sequence: int
    period: int
    minute: int
    second: int
    timelineOffsetMs: int
    type: str
    team: TeamRef
    player: PlayerRef | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class FactEvidence(BaseModel):
    description: str
    query: str
    result: Any
    source: str


class Fact(BaseModel):
    id: str
    matchId: str
    eventId: str
    text: str
    category: FactCategory
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: FactEvidence
    createdAt: str


class EventRequest(BaseModel):
    event: GameEvent


class FactsResponse(BaseModel):
    facts: list[Fact]
    generator: str


class ResetRequest(BaseModel):
    matchId: str


class Health(BaseModel):
    status: str
    ready: bool
    model: str
    statsStore: str = "file"
