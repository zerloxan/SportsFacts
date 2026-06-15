# ai-fact-agent Specification

## Purpose
TBD - created by archiving change ai-fact-agent. Update Purpose after archive.
## Requirements
### Requirement: Tool-verified fact generation
The AI service SHALL generate facts using a LangGraph agent that calls stats-query tools, and SHALL only emit a record/first/milestone fact after a tool has returned supporting data. Every emitted fact SHALL include `evidence` and validate against the shared `Fact` contract.

#### Scenario: Agent verifies before asserting
- **WHEN** a goal event is processed and the agent calls a stats tool that returns a supporting record
- **THEN** the agent emits a fact whose `evidence.result` contains that tool result

#### Scenario: emit_fact requires evidence
- **WHEN** the agent attempts to emit a fact
- **THEN** the `emit_fact` tool requires an evidence payload, so a fact without supporting evidence cannot be produced

### Requirement: Fact-worthiness pre-filter
The agent graph SHALL invoke the language model only for fact-worthy events (e.g. goals, red cards), returning no facts for routine events without calling the model.

#### Scenario: Routine event skips the model
- **WHEN** a non-fact-worthy event (e.g. a pass) is processed
- **THEN** no model call is made and an empty fact list is returned

### Requirement: Per-match running state
The service SHALL maintain running match state (score, per-player in-match goals and timings) updated as events arrive, and SHALL expose a reset that clears it.

#### Scenario: Reset clears state
- **WHEN** a reset is requested for a match
- **THEN** subsequent events are scored as if from the start of the match

### Requirement: Graceful degradation and gateway routing
The gateway SHALL route fact generation to the AI service when `AI_SERVICE_URL` is set and the service reports ready; otherwise it SHALL use the deterministic generator. The AI service SHALL report readiness based on whether an Anthropic API key is configured.

#### Scenario: No API key falls back
- **WHEN** the gateway starts with `AI_SERVICE_URL` set but the service reports not ready (no API key)
- **THEN** the gateway uses the deterministic fact generator and logs the reason

#### Scenario: Health reports model and readiness
- **WHEN** the AI service health endpoint is queried
- **THEN** it returns whether Claude is live and which model is configured

### Requirement: Pluggable stats store (Postgres or file)
The AI service SHALL select its stats store by configuration: when `DATABASE_URL` is set it SHALL query Postgres, otherwise it SHALL use the file-based normalized artifact. Both stores SHALL expose the same query surface, and tool-produced evidence SHALL record which source was used.

#### Scenario: Postgres store used when configured
- **WHEN** the service starts with `DATABASE_URL` set and the agent processes a goal
- **THEN** the tournament-tally tool returns a count computed from the Postgres `goals` table and the fact's evidence cites the database source

#### Scenario: File store used without a database
- **WHEN** the service starts without `DATABASE_URL`
- **THEN** it uses the file-based store and continues to produce evidence-backed facts

### Requirement: Database-counted tournament tally
When backed by Postgres, the `query_player_tournament_goals` tool SHALL count the player's goals from matches earlier than the current match in the same competition, rather than a curated constant.

#### Scenario: Tally reflects real prior matches
- **WHEN** the agent asks for a player's pre-match tournament goals
- **THEN** the returned number equals the count of that player's goals in earlier competition matches in the database

