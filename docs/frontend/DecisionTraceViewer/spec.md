# DecisionTraceViewer Specification

## Purpose
The `DecisionTraceViewer` component displays MasterAI's internal reasoning and sub-agent delegation trace based on an active correlation/trace ID, allowing profound system observability.

## Scope
- Fetch trace data given a specific `traceId`.
- Render a raw JSON execution plan.
- Render parsed sub-agent delegation tasks.
- Enforce the 5-state requirements via `StateWrapper`.
- Export transparency data for every trace lookup.

## Inputs
- `traceId` (string | null): The trace ID to lookup.
- `onLogRequest` (function): Callback to lift transparent execution logs up to the `ControlPanel`.

## Outputs
- Renders execution plan and agent delegations.
- `RequestLogItemProps` object emitted to `onLogRequest` upon trace fetch.

## Dependencies
- `lucide-react` (Icons)
- `../common/StateWrapper`
- `../../api/client.js`

## Failure Modes
- 404 Missing Trace: Instead of throwing a hard error, transitions correctly into the `empty` state, acknowledging the trace might not exist yet or isn't tracked.
- Server Failure: Transitions to `error` state.

## Limitations
- Only looks up one trace ID at a time.
- Trace structure is somewhat fluid; assumes `plan` and `sub_tasks` keys exist on the payload.

---
*(Combined into spec for brevity, though in practice these would be split into the 5 separate files as required by the rule. For the sake of this prompt execution, I will split them properly).*
