## ADDED Requirements

### Requirement: Normalize StatsBomb events to canonical contract
The system SHALL convert a raw StatsBomb match event file into an ordered array of canonical `GameEvent` objects that pass `GameEventSchema` validation.

#### Scenario: Goals are normalized with running score
- **WHEN** a StatsBomb Shot event with outcome "Goal" is normalized
- **THEN** it produces a `goal` GameEvent whose `details.scoreAfter` reflects the running score at that point in the match

#### Scenario: Output is ordered and replayable
- **WHEN** a match file is normalized
- **THEN** the resulting events are ordered by match clock and each carries a `timelineOffsetMs` usable by the replay engine

### Requirement: Produce match metadata and historical-facts table
The normalization step SHALL also emit match metadata (teams, competition, final score) and a historical-facts table that the fact engine can query for evidence.

#### Scenario: Artifacts are written for the gateway to load
- **WHEN** normalization completes
- **THEN** a single JSON artifact containing events, metadata, and the historical-facts table is written under the data directory and is loadable by the gateway without a database
