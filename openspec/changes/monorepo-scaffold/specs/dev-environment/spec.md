## ADDED Requirements

### Requirement: Monorepo workspace layout
The project SHALL be organized as a single pnpm + Turborepo monorepo with an `apps/` directory for deployable services and a `packages/` directory for shared libraries.

#### Scenario: Workspaces are discoverable
- **WHEN** a developer runs `pnpm install` at the repository root
- **THEN** pnpm resolves all workspaces declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`) without error

#### Scenario: Turborepo orchestrates tasks
- **WHEN** a developer runs `pnpm turbo run build` (or `lint`, `typecheck`) at the root
- **THEN** Turborepo executes the corresponding task across all workspaces that define it, respecting dependency order

### Requirement: Shared tooling and configuration
The repository SHALL provide shared TypeScript, lint, and formatting configuration so all workspaces follow consistent standards.

#### Scenario: Shared TypeScript base config
- **WHEN** a workspace's `tsconfig.json` extends the shared base config
- **THEN** it inherits strict compiler options without redefining them locally

#### Scenario: Lint and format run cleanly on a fresh checkout
- **WHEN** a developer runs `pnpm lint` and `pnpm format:check` on a fresh checkout
- **THEN** both commands complete with a zero exit code

### Requirement: Local infrastructure via Docker Compose
The repository SHALL provide a Docker Compose configuration that provisions PostgreSQL and Redis for local development, configured via environment variables documented in `.env.example`.

#### Scenario: Infrastructure starts
- **WHEN** a developer runs `docker compose up -d` with values copied from `.env.example`
- **THEN** PostgreSQL and Redis containers start and report healthy

#### Scenario: Connection details are documented
- **WHEN** a developer opens `.env.example`
- **THEN** it lists every environment variable required to connect to Postgres and Redis with safe placeholder defaults

### Requirement: Placeholder service workspaces
The repository SHALL include placeholder workspaces for `apps/web`, `apps/gateway`, `apps/ai-service`, `packages/shared-types`, and `packages/db` so later changes can implement them incrementally.

#### Scenario: Placeholders are valid workspaces
- **WHEN** `pnpm install` runs
- **THEN** each placeholder workspace is recognized by pnpm and does not break the install or Turborepo task graph
