## ADDED Requirements

### Requirement: Pub/sub abstraction with swappable backends
The system SHALL provide an `EventBus` interface supporting publish and subscribe over named topics, with at least an in-memory implementation and a Redis-Streams implementation behind the same interface.

#### Scenario: In-memory bus delivers to subscribers
- **WHEN** a message is published to a topic on the in-memory bus and a subscriber is listening on that topic
- **THEN** the subscriber receives the message

#### Scenario: Backend selected by configuration
- **WHEN** `REDIS_URL` is set in the environment
- **THEN** the application uses the Redis-Streams implementation; otherwise it falls back to the in-memory implementation without code changes

### Requirement: Topic isolation
Messages published to one topic SHALL NOT be delivered to subscribers of a different topic.

#### Scenario: Subscribers only receive their topic
- **WHEN** a message is published to `game.events`
- **THEN** a subscriber listening only on `game.facts` does not receive it
