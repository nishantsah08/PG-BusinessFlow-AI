# AgentDashboard Decisions

## Architecture Decisions
- **Lifecycle Visibility**: [UPDATED — System Update requirement for strict UI visibility without silent reverts] Toggles and actions wait for backend confirmation and enforce strict execution states (`processing`, `success`, `error`) to guarantee visibility without reverting optimistically.
- **Agent Fetching via Event Stream**: [UPDATED — System Update requirement to remove polling] To adhere to the reactive architecture rules, we subscribe to `/api/system/events/stream` using a frontend `useRealtimeSource` hook, eliminating explicit interval polling entirely.
- **Architecture Diagram (ReactFlow)**: Transitioned from a standard CSS Grid of cards to an interactive ReactFlow diagram. This decision visually reinforces the architecture rules (Master AI orchestrates via MCP, Agents communicate back only via the Event Bus) making the system's strict topologies obvious to users. AgentCards are wrapped inside `AgentNode`s.

## Rejected Alternatives
- *Direct WebSocket to Agents*: Rejected due to Architecture Rule 2 (never call agents directly).
- *Global Redux Agent State*: Rejected due to Architecture Rule 4 (UI must never store agent state locally).

## Assumptions
- Agents can either be "online", "offline" or "quarantined".
- "quarantine" action exists alongside enable/disable/restart.
