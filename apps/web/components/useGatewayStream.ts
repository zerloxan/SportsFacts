"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  ServerMessage,
  MatchMeta,
  ReplayState,
  GameEvent,
  Fact,
} from "./types";

const GATEWAY_HTTP =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8787";
const GATEWAY_WS = GATEWAY_HTTP.replace(/^http/, "ws") + "/ws";

const MAX_EVENTS = 40;
const MAX_FACTS = 30;

export interface StreamState {
  connected: boolean;
  meta: MatchMeta | null;
  state: ReplayState | null;
  events: GameEvent[];
  facts: Fact[];
}

export function useGatewayStream(): StreamState & {
  control: (path: string, body?: unknown) => void;
} {
  const [connected, setConnected] = useState(false);
  const [meta, setMeta] = useState<MatchMeta | null>(null);
  const [state, setState] = useState<ReplayState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let reconnect: ReturnType<typeof setTimeout>;

    const connect = (): void => {
      const ws = new WebSocket(GATEWAY_WS);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) reconnect = setTimeout(connect, 1500);
      };
      ws.onmessage = (ev: MessageEvent<string>) => {
        const msg = JSON.parse(ev.data) as ServerMessage;
        switch (msg.kind) {
          case "snapshot":
            setMeta(msg.data.meta);
            setState(msg.data.state);
            setEvents(msg.data.recentEvents.slice(-MAX_EVENTS));
            setFacts(msg.data.recentFacts.slice(-MAX_FACTS));
            break;
          case "event":
            setEvents((prev) => [...prev, msg.data].slice(-MAX_EVENTS));
            break;
          case "fact":
            setFacts((prev) => [...prev, msg.data].slice(-MAX_FACTS));
            break;
          case "state":
            setState(msg.data);
            break;
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnect);
      wsRef.current?.close();
    };
  }, []);

  const control = useCallback((path: string, body?: unknown): void => {
    void fetch(`${GATEWAY_HTTP}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }, []);

  return { connected, meta, state, events, facts, control };
}
