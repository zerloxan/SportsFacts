## ADDED Requirements

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
