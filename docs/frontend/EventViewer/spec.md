# EventViewer Specification

## Purpose
The `EventViewer` component displays a real-time or polled log of system events returned from MasterAI, providing continuous observation of backend activities.

## Scope
- Periodically poll the `/api/master_ai/events` endpoint.
- Render chronological list of event structures.
- Support manual refresh via UI trigger.
- Enforce the 5-state requirements via `StateWrapper`.
- Export transparency data for every polling operation.

## Inputs
- `onLogRequest` (function): Callback to lift transparent execution logs up to the `ControlPanel`.

## Outputs
- Renders an array of event objects.
- `RequestLogItemProps` object emitted to `onLogRequest` upon every polling cycle.

## Dependencies
- `lucide-react` (Icons)
- `../common/StateWrapper`
- `../../api/client.js`

## Failure Modes
- Polling failure: The fallback UI displays the error state but retains the last good polling data under the hood. Only the primary wrapper displays the visual error cue.
- Invalid response shape: Fails gracefully and trips the error boundary if unhandled data structures arrive.

## Limitations
- Operates on a fixed 10-second polling interval (not WebSocket driven yet).
- Stores events strictly locally; data is lost on component unmount.
