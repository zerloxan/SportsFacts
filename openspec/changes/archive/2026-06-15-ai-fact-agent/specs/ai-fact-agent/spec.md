## ADDED Requirements

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
