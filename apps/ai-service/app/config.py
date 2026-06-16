"""Service configuration, read from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# repo root = .../apps/ai-service/app/config.py -> parents[3]
REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    model: str
    api_key: str | None
    data_file: Path
    database_url: str | None
    kafka_brokers: str | None
    kafka_group_id: str

    @property
    def ready(self) -> bool:
        """The agent can make live Claude calls only with an API key."""
        return bool(self.api_key)


def load_config() -> Config:
    data_file = os.environ.get("MATCH_DATA_FILE")
    return Config(
        host=os.environ.get("AI_SERVICE_HOST", "0.0.0.0"),
        port=int(os.environ.get("AI_SERVICE_PORT", "8000")),
        model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
        data_file=Path(data_file)
        if data_file
        else REPO_ROOT / "data" / "normalized" / "3869685.json",
        database_url=os.environ.get("DATABASE_URL") or None,
        kafka_brokers=os.environ.get("KAFKA_BROKERS") or None,
        kafka_group_id=os.environ.get("KAFKA_GROUP_ID", "ai-service"),
    )
