## 1. Data normalization

- [x] 1.1 Add `scripts/normalize-match.ts` converting StatsBomb events → canonical `GameEvent[]` + metadata + historical-facts table
- [x] 1.2 Run it on match 3869685 and write `data/normalized/3869685.json`
- [x] 1.3 Validate the normalized events against `GameEventSchema`

## 2. Event bus package

- [x] 2.1 Create `packages/event-bus` with an `EventBus` interface
- [x] 2.2 Implement `InMemoryEventBus`
- [x] 2.3 Implement `RedisEventBus` (ioredis, Streams) behind the same interface
- [x] 2.4 Add `createEventBus()` factory selecting backend by `REDIS_URL`
- [x] 2.5 Unit-test in-memory delivery + topic isolation

## 3. Gateway: replay + facts + WebSocket

- [x] 3.1 Add Fastify app in `apps/gateway` with `/health` and CORS
- [x] 3.2 Implement the replay engine (timeline emit, speed, pause, seek) publishing to `game.events`
- [x] 3.3 Implement the deterministic, evidence-backed fact engine subscribing to `game.events`, publishing `game.facts`
- [x] 3.4 Add a `ClaudeFactGenerator` interface stub that falls back to deterministic when no API key
- [x] 3.5 Define the typed WS envelope and stream events/facts/state/snapshot to clients
- [x] 3.6 Add replay control endpoints (start, pause, speed, seek)
- [x] 3.7 Unit-test the fact engine: goal → evidence-backed fact; no record → no record-fact; reset clears state

## 4. Announcer dashboard

- [x] 4.1 Scaffold Next.js (App Router) + Tailwind in `apps/web`
- [x] 4.2 WebSocket client hook consuming the typed envelope
- [x] 4.3 Scoreboard + match clock from events
- [x] 4.4 Event ticker + streaming fact cards showing evidence
- [x] 4.5 Replay controls (start/pause/speed) calling the gateway

## 5. Wiring and verification

- [x] 5.1 Root `dev` runs gateway + web together; document ports
- [x] 5.2 `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [x] 5.3 Run the stack, confirm the dashboard shows live events, a moving score, and evidence-backed facts (verified: 3-3, accurate Mbappé hat-trick fact, no console errors)
- [x] 5.4 Update README with run instructions for the demo
