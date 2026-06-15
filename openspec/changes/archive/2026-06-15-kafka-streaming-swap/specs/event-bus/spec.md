## MODIFIED Requirements

### Requirement: Pub/sub abstraction with swappable backends
The system SHALL provide an `EventBus` interface supporting publish and subscribe over named topics, with in-memory, Redis-Streams, and Kafka/Redpanda implementations behind the same interface. The backend SHALL be selected by configuration without changes to producer or consumer code.

#### Scenario: In-memory bus delivers to subscribers
- **WHEN** a message is published to a topic on the in-memory bus and a subscriber is listening on that topic
- **THEN** the subscriber receives the message

#### Scenario: Backend selected by configuration
- **WHEN** `KAFKA_BROKERS` is set, the application uses the Kafka implementation; otherwise when `REDIS_URL` is set it uses Redis-Streams; otherwise it falls back to in-memory
- **THEN** the selection happens without any change to code that publishes or subscribes

#### Scenario: Kafka round-trip
- **WHEN** the Kafka backend is configured and a message is published to a topic
- **THEN** a subscriber consuming that topic via a consumer group receives the message

## ADDED Requirements

### Requirement: Kafka topic provisioning
When using the Kafka backend, the system SHALL ensure the required topics (`game.events`, `game.facts`) exist before producing, creating them if missing.

#### Scenario: Topics auto-created on startup
- **WHEN** the gateway starts with the Kafka backend against a broker that has no topics yet
- **THEN** the required topics are created and publishing succeeds
