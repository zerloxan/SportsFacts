"""A minimal fake chat model that returns a scripted sequence of AIMessages,
so the LangGraph agent can be tested without calling Claude (no tokens spent).
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage


class FakeToolModel:
    def __init__(self, responses: list[AIMessage]) -> None:
        self._responses = list(responses)
        self._i = 0
        self.calls = 0

    def bind_tools(self, _tools: Any) -> "FakeToolModel":
        return self

    def invoke(self, _messages: Any) -> AIMessage:
        self.calls += 1
        msg = self._responses[self._i]
        self._i += 1
        return msg
