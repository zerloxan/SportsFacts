"""The LangGraph fact-generation agent.

Graph shape:  START ──(fact-worthy?)──▶ agent ⇄ tools ──▶ END

The `agent` node is Claude bound to the verification tools; the `tools` node
runs them. The loop continues while the model keeps calling tools, and ends
when it stops (having called `emit_fact` for each verified fact). Non
fact-worthy events short-circuit to END without any model call.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from .schemas import GameEvent
from .state import MatchState
from .store import StatsStore
from .tools import build_tools

SYSTEM_PROMPT = """You are SportsFacts, a real-time soccer commentary fact engine.
You work ONLY by calling tools — never reply with prose.

For a goal event, do this every time:
1. Call `query_player_tournament_goals` for the scorer's pre-match tally.
2. Call `query_in_match_state` for the scorer's goals/timings in this match.
3. Optionally call `query_records` to find a relevant historical record.
4. Then call `emit_fact` once for EACH broadcast-worthy fact you can back with \
those tool results (e.g. an updated tournament total, a brace/hat-trick, \
rapid-fire goals, a record). Put the numbers you retrieved in the evidence.

Rules:
- NEVER assert a number you did not get from a tool.
- You MUST call `emit_fact` at least once for a goal by a player who appears in \
`query_player_tournament_goals`. Keep to at most 3 facts, highest-signal first.
- When you have emitted your facts, stop (return no further tool calls).
"""


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    fact_worthy: bool


def _describe_event(event: GameEvent, state: MatchState, store: StatsStore) -> str:
    name = (
        store.nickname(event.player.id, event.player.name)
        if event.player
        else event.team.name
    )
    meta = store.meta
    home, away = meta["home"]["name"], meta["away"]["name"]
    if event.type == "goal":
        score = event.details.get("scoreAfter", state.score)
        pen = " (penalty)" if event.details.get("penalty") else ""
        return (
            f"GOAL{pen}: {name} (id={event.player.id if event.player else 'NA'}) "
            f"for {event.team.name} at {event.minute}'. "
            f"Score now {home} {score.get('home')}-{score.get('away')} {away}. "
            f"Find and emit the most broadcast-worthy, verified facts."
        )
    if event.type == "card":
        return f"RED CARD: {name} ({event.team.name}) sent off at {event.minute}'."
    return f"{event.type} by {name} at {event.minute}'."


def build_graph(model_with_tools: Any, tools: list[Any]) -> Any:
    def agent_node(state: AgentState) -> dict[str, Any]:
        resp = model_with_tools.invoke(state["messages"])
        tool_calls = getattr(resp, "tool_calls", None) or []
        logging.getLogger("ai-service.agent").info(
            "agent step: %d tool call(s) %s",
            len(tool_calls),
            [t.get("name") for t in tool_calls],
        )
        return {"messages": [resp]}

    def route_start(state: AgentState) -> str:
        return "agent" if state["fact_worthy"] else END

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", None)
        return "tools" if tool_calls else END

    builder = StateGraph(AgentState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(tools))
    builder.add_conditional_edges(START, route_start, {"agent": "agent", END: END})
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", END: END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


def run_agent(
    model: Any,
    store: StatsStore,
    state: MatchState,
    event: GameEvent,
    tally: Any | None = None,
) -> list[dict[str, Any]]:
    """Run the agent for one event and return the emitted fact dicts."""
    collector: list[dict[str, Any]] = []
    tools = build_tools(store, state, collector, event.matchId, event.id, tally)
    graph = build_graph(model.bind_tools(tools), tools)
    graph.invoke(
        {
            "messages": [
                SystemMessage(SYSTEM_PROMPT),
                HumanMessage(_describe_event(event, state, store)),
            ],
            "fact_worthy": state.is_fact_worthy(event),
        },
        config={"recursion_limit": 12},
    )
    return collector
