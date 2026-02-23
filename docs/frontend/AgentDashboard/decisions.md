# AgentDashboard Decisions

## Architecture Decisions
- **Lifecycle Visibility**: [UPDATED — System Update requirement for strict UI visibility without silent reverts] Toggles and actions wait for backend confirmation and enforce strict execution states (`processing`, `success`, `error`) to guarantee visibility without reverting optimistically.
- **Agent Fetching via Event Stream**: [UPDATED — System Update requirement to remove polling] To adhere to the reactive architecture rules, we subscribe to `/api/system/events/stream` using a frontend `useRealtimeSource` hook, eliminating explicit interval polling entirely.
- **Card Based Layout**: `AgentCard` isolates the display and control logic for individual agents enabling cleaner code, individual loading states (buttons), and better responsivity.

## Rejected Alternatives
- *Direct WebSocket to Agents*: Rejected due to Architecture Rule 2 (never call agents directly).
- *Global Redux Agent State*: Rejected due to Architecture Rule 4 (UI must never store agent state locally).

## Assumptions
- Agents can either be "online", "offline" or "quarantined".
- "quarantine" action exists alongside enable/disable/restart.
