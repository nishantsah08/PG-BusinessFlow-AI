# Specification: SystemObservationPanel

## Purpose
Provides a stacked-card interface for developer and transparency tools (Live Events, Decision Trace, Latency), replacing the previous vertical stacked layout. It allows users to toggle the visibility of the developer view to expand the main chat interface.

## Behavior
- Renders as a full sidebar (md:w-2/5) or a collapsed strip (md:w-12) based on the `isOpen` prop.
- Manages an internal `activeTab` state to switch between rendering `EventViewer`, `DecisionTraceViewer`, and `LatencyDisplay`.
- Triggers the `onToggle` callback when the user clicks the open/close buttons.
- Passes necessary data (`lastTraceId`, `requestLogs`, `onLogRequest`) through to child components.
