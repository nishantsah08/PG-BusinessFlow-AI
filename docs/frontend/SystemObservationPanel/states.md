# States: SystemObservationPanel

## Visual States
1. **Open**: Sidebar is expanded (`isOpen` is true), showing the tab selector and the active panel content.
2. **Closed**: Sidebar is collapsed (`isOpen` is false), showing only a vertical label and an expand button.
3. **Tab Active (Events/Trace/Latency)**: One of the internal panels is visible, indicated by the highlighted tab, while the others are hidden. Renders either `EventViewer`, `DecisionTraceViewer`, or `LatencyDisplay`.
