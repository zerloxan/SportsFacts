## ADDED Requirements

### Requirement: Live announcer dashboard
The web app SHALL connect to the gateway WebSocket and render a live scoreboard, an event ticker, and streaming fact cards as the match replays.

#### Scenario: Facts appear with their evidence
- **WHEN** a fact message arrives over the WebSocket
- **THEN** a fact card is rendered showing the fact text, its category, and the supporting evidence ("why this is true")

#### Scenario: Scoreboard tracks goals
- **WHEN** a `goal` event arrives
- **THEN** the scoreboard updates to the new score and the event ticker shows the goal

### Requirement: Replay controls in the UI
The dashboard SHALL provide controls to start/pause replay and change speed, calling the gateway control API.

#### Scenario: Speed control round-trips
- **WHEN** the user changes the speed control in the UI
- **THEN** the dashboard calls the gateway and the incoming stream rate changes accordingly
