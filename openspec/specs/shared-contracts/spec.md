# shared-contracts Specification

## Purpose
TBD - created by archiving change monorepo-scaffold. Update Purpose after archive.
## Requirements
### Requirement: Canonical game event schema
The `packages/shared-types` package SHALL define a canonical, Zod-based schema for normalized game events that the replay engine produces and the gateway and AI service consume.

#### Scenario: Valid event passes validation
- **WHEN** a normalized game event containing an id, match id, minute/second timestamp, event type, team, and type-specific payload is parsed with the event schema
- **THEN** validation succeeds and a typed object is returned

#### Scenario: Invalid event is rejected
- **WHEN** an object missing a required field (e.g., event type) is parsed with the event schema
- **THEN** validation fails with a descriptive error rather than silently passing

### Requirement: Canonical fact schema
The `packages/shared-types` package SHALL define a Zod-based schema for AI-generated facts, including the fact text, the triggering event reference, a confidence/category, and the supporting evidence used to verify it.

#### Scenario: Fact carries verifying evidence
- **WHEN** a fact object is parsed with the fact schema
- **THEN** validation requires a supporting-evidence field so unverified facts cannot be represented as valid

### Requirement: Single source of truth for types
The schemas SHALL be exported as both runtime validators and inferred TypeScript types so all TypeScript services import identical contracts from one package.

#### Scenario: Inferred types are exported
- **WHEN** another workspace imports the event or fact type from `packages/shared-types`
- **THEN** it receives the TypeScript type inferred from the Zod schema without redeclaring the shape

