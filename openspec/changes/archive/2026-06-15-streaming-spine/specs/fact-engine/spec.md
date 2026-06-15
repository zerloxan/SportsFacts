## ADDED Requirements

### Requirement: Evidence-backed fact generation
The fact engine SHALL consume live events and emit `Fact` objects that pass `FactSchema` validation, each carrying supporting `evidence`. It SHALL NOT emit a fact asserting a record/first/milestone without a corresponding evidence entry.

#### Scenario: Goal produces an evidence-backed fact
- **WHEN** a `goal` event is consumed and the historical-facts table contains a relevant record (e.g., a player's tournament goal tally)
- **THEN** a fact is emitted whose `evidence.result` contains the queried record and whose `text` reflects it

#### Scenario: No fabricated records
- **WHEN** no supporting record exists for a candidate claim
- **THEN** the engine does not emit that claim as a record/first/milestone fact

### Requirement: Deterministic default, optional Claude
The engine SHALL run deterministically without external services, and SHALL use a Claude-backed generator only when `ANTHROPIC_API_KEY` is configured.

#### Scenario: Runs without an API key
- **WHEN** no `ANTHROPIC_API_KEY` is set
- **THEN** the engine still produces evidence-backed facts using the deterministic generator
