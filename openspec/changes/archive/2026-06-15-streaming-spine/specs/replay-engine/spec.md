## ADDED Requirements

### Requirement: Timeline replay of a normalized match
The replay engine SHALL emit normalized events to the event bus paced by their `timelineOffsetMs`, simulating a live feed.

#### Scenario: Events emit in order over time
- **WHEN** replay starts at speed 1x
- **THEN** events are published to `game.events` in match-clock order with inter-event delays proportional to their timeline offsets

### Requirement: Playback controls
The replay engine SHALL support adjustable speed, pause/resume, and seek to a given match minute.

#### Scenario: Speed multiplier compresses delays
- **WHEN** the speed is set to 10x
- **THEN** the wall-clock delay between consecutive events is one tenth of the real match interval

#### Scenario: Pause halts emission
- **WHEN** replay is paused
- **THEN** no further events are published until it is resumed
