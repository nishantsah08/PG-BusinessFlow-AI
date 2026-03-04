# DecisionTraceViewer Design Decisions

## 1. Separation from Chat UI
- **Why built this way:** Traces are highly verbose JSON structures. Injecting them into the conversational chat flow ruins the UI. Keeping it separated into a "Data/Developer" panel satisfies the architectural need for high debuggability without ruining the UX.
- **Alternatives considered:** Collapsible trace accordions inside the chat feed (`ChatPanel`).
- **Why rejected:** Clutters DOM, drastically increases memory per chat session, and mixes interaction data with observability data.
- **Assumptions made:** Developers/Operators will only periodically cross-reference a specific correlation ID.

## 2. Empty State Overrides
- **Why built this way:** Trace IDs are generated optimisticly on the frontend, MasterAI's tracing backend might take a second to commit the trace. Intercepting 404s to `empty` rather than `error` handles this graceful delay.
- **Alternatives considered:** Immediately throwing a red error box for "Trace Not Found".
- **Why rejected:** Causes immediate user panic for a temporal syncing issue. 
- **Assumptions made:** `404` is the only guaranteed semantic error for "Trace Not Yet Written".

## 3. Strict Transparency Emission
- **Why built this way:** Even requests meant to debug the system (fetching traces) must themselves be transparently logged.
- **Alternatives considered:** Silencing the trace endpoint from `LatencyDisplay`.
- **Why rejected:** Violates the "zero invisible system behaviors" rule.
- **Assumptions made:** `ControlPanel` handles rendering this trace event transparently.
