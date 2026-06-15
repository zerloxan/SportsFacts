# realtime-gateway Specification

## Purpose
TBD - created by archiving change streaming-spine. Update Purpose after archive.
## Requirements
### Requirement: Typed WebSocket message envelope
The gateway SHALL fan out events, facts, and replay-state updates to clients over a single WebSocket using one discriminated message envelope.

#### Scenario: Clients receive typed messages
- **WHEN** a client connects to the gateway WebSocket
- **THEN** it receives messages tagged by kind (`event`, `fact`, `state`, `snapshot`) that a typed client can discriminate

#### Scenario: Late joiner gets current state
- **WHEN** a client connects mid-replay
- **THEN** it first receives a `snapshot` describing current score, clock, and recent facts before the live stream continues

### Requirement: Replay control API
The gateway SHALL expose HTTP endpoints to start, pause, set speed, and seek the replay, and a health endpoint.

#### Scenario: Control changes take effect
- **WHEN** a client POSTs a speed change to the control endpoint
- **THEN** subsequent events stream at the new speed and connected clients receive a `state` update reflecting it

#### Scenario: Health endpoint
- **WHEN** a client requests the health endpoint
- **THEN** the gateway responds with a success status and basic readiness information

