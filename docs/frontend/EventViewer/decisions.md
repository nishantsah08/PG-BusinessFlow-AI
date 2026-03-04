# EventViewer Design Decisions

## 1. Local State Only for Events
- **Why built this way:** Events are workflow state; architecture forbids storing this globally.
- **Alternatives considered:** Storing events in a global Redux/Context store for access on other pages.
- **Why rejected:** Violates the explicit "Forbidden global state" rule.
- **Assumptions made:** Event history is only relevant while actively observing the ControlPanel.

## 2. Silent Background Polling
- **Why built this way:** Prevents the UI from flashing a loading spinner every 10 seconds.
- **Alternatives considered:** WebSockets / Server-Sent Events (SSE).
- **Why rejected:** Requires backend infrastructure changes that were not specified in the current frontend-only architecture rules. Short-polling is a safe MVP.
- **Assumptions made:** A 10-second delay in event visibility is acceptable for Phase 2.

## 3. Transparency Elevation (`onLogRequest`)
- **Why built this way:** Emulating the MasterAI interactions fully transparently without cluttering the event log payload UI.
- **Alternatives considered:** Discarding automated polling logs entirely from transparency.
- **Why rejected:** Violates the "UI must never hide system behavior" rule. Every fetch must be shown.
- **Assumptions made:** `ControlPanel` will handle and truncate the high volume of polling logs.
