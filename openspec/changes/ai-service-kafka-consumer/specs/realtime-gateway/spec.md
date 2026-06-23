## ADDED Requirements

### Requirement: Relay-only fact mode
The gateway SHALL support a relay-only mode, selected by `GATEWAY_GENERATE_FACTS=false`, in which it does NOT generate or publish facts and instead only fans out `game.events` and `game.facts` to WebSocket clients. This lets the Kafka-native AI service be the sole fact producer with no double-emission. When the flag is unset or `true` (the default), the gateway generates facts as before.

#### Scenario: Relay mode does not produce facts
- **WHEN** the gateway starts with `GATEWAY_GENERATE_FACTS=false`
- **THEN** it does not call any fact generator and publishes nothing to `game.facts`, while still forwarding events and externally-produced facts to connected clients

#### Scenario: Externally produced facts still reach clients
- **WHEN** the gateway is in relay-only mode and a fact appears on `game.facts` (produced by the AI service)
- **THEN** connected WebSocket clients receive that fact via the `fact` message kind

#### Scenario: Default mode is unchanged
- **WHEN** the gateway starts without `GATEWAY_GENERATE_FACTS` set
- **THEN** it generates facts using the selected generator exactly as before this change
