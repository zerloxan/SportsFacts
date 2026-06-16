## ADDED Requirements

### Requirement: Kafka-native event ingestion
When `KAFKA_BROKERS` is configured, the AI service SHALL consume `game.events` from Kafka, run the fact agent for each event, and publish validated facts to `game.facts` directly, without a gateway HTTP call in the path. The service SHALL use a stable consumer group (default `ai-service`) so each event is processed once, and SHALL read from the latest offset to match live-stream semantics. The HTTP `POST /events` path SHALL remain available for the in-memory / Redis demo and for tests.

#### Scenario: Event consumed from Kafka produces a fact on Kafka
- **WHEN** the service is running with `KAFKA_BROKERS` set and a fact-worthy `goal` event is published to `game.events`
- **THEN** the agent runs, and a validated fact for that event is published to `game.facts`

#### Scenario: Only validated facts are published
- **WHEN** the agent produces an output that does not satisfy the shared `Fact` contract
- **THEN** that output is dropped (not published to `game.facts`) and the stream continues

#### Scenario: HTTP path still works without Kafka
- **WHEN** the service is started without `KAFKA_BROKERS` and the gateway calls `POST /events`
- **THEN** the service responds with facts over HTTP exactly as before

### Requirement: Consumer resilience
The Kafka ingestion loop SHALL NOT crash the service on a single bad message or a transient agent error: it SHALL log the failure and continue consuming subsequent events.

#### Scenario: Bad message is skipped
- **WHEN** a message on `game.events` cannot be parsed as a `GameEvent`, or the agent raises during processing
- **THEN** the error is logged and the consumer proceeds to the next event without exiting

## MODIFIED Requirements

### Requirement: Per-match running state
The service SHALL maintain running match state (score, per-player in-match goals and timings) updated as events arrive, and SHALL clear it both on an explicit reset (HTTP `POST /reset`) and when a `kickoff` event is observed on the consumed stream (Kafka path), so a replay restart does not accumulate counts across passes.

#### Scenario: Reset clears state
- **WHEN** a reset is requested for a match
- **THEN** subsequent events are scored as if from the start of the match

#### Scenario: Kickoff on the stream resets state
- **WHEN** the service is consuming from Kafka and a `kickoff` event arrives for a match it has already accumulated state for
- **THEN** that match's running state is cleared before the kickoff is processed, so counts do not carry over from the previous replay
