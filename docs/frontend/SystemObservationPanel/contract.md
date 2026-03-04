# Contract: SystemObservationPanel

## Props
- `isOpen` (boolean): Read-only state determining if the panel is fully visible or collapsed.
- `onToggle` (function): Callback triggered when the expand/collapse button is clicked.
- `onLogRequest` (function): Callback handler passed down to `EventViewer` and `DecisionTraceViewer`.
- `lastTraceId` (string | null): The ID passed down to `DecisionTraceViewer`.
- `requestLogs` (array): The latency logs array passed down to `LatencyDisplay`.
