# AgentDashboard Specification

## Purpose
Provide a high-level orchestration interface to view and manage all system agents (enabling, disabling, restarting).

## Scope
- List all agents and their status
- Display the last heartbeat, latency to MasterAI, and latest errors
- Allow toggling an agent's active state
- Allow restarting an agent process
- Adhere strictly to 5-state rendering
- Never communicate directly with any agent

## Inputs
None directly. Data is fetched from `GET /api/system/agents`. User input is supplied via toggle and restart buttons on child cards.

## Outputs
- `AgentCard` UI components per agent.
- `apiClient` requests to MasterAI for state changes.
- UI Toasts for action failures or successes.

## Dependencies
- `StateWrapper` for UI consistency.
- `useUI` context for toast notifications.
- `apiClient` for ALL actions and queries.

## Failure modes
- MasterAI unreachable: Display `StateWrapper` error state.
- Agent control failed: Revert optimistic UI, show Toast with Request ID.
- Empty agent list: Display `StateWrapper` empty state.
- Invalid response format: Throw error caught by ErrorBoundary/StateWrapper.

## Limitations
- UI does not have real-time websocket connections to agents. Polling relies on MasterAI.
- Dashboard does not display the actual work/workflows of the agents, just their daemon status.
