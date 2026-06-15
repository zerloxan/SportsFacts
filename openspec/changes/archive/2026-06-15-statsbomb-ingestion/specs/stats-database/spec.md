## ADDED Requirements

### Requirement: Postgres stats schema
The system SHALL define a Postgres schema for `matches`, `players`, and `goals` (with foreign keys from goals to matches and players) managed by Drizzle migrations.

#### Scenario: Migrations create the schema
- **WHEN** the migrations are applied to an empty database
- **THEN** the `matches`, `players`, and `goals` tables exist with their columns and foreign keys

### Requirement: Idempotent StatsBomb ingestion
The system SHALL provide an ingestion pipeline that loads a StatsBomb competition's matches, players, and goals into Postgres, and SHALL be safe to run repeatedly without creating duplicates.

#### Scenario: Goals are loaded
- **WHEN** the ingestion runs for the 2022 World Cup
- **THEN** the `goals` table contains the tournament's goals, each linked to a match and a player

#### Scenario: Re-running does not duplicate
- **WHEN** the ingestion is run a second time
- **THEN** row counts are unchanged (upsert by natural key)

### Requirement: Tournament tally query
The schema SHALL support counting a player's goals scored in matches that occurred BEFORE a given match within the same competition/season.

#### Scenario: Pre-match tally excludes the current and later matches
- **WHEN** counting a player's tournament goals before a specific match
- **THEN** only goals from earlier matches in that competition are included
