# ChatPanel Specification

## Purpose
The `ChatPanel` provides the primary user interface for text-based interaction with MasterAI. It acts as the conversational entry point for the system.

## Scope
- Capture user text input.
- Display a chronological history of the current interaction session.
- Manage local optimistic updates for immediate perceived responsiveness.
- Strictly enforce communication only through the designated `apiClient`.
- Strictly enforce the 5-states visual requirements using `StateWrapper`.
- Ensure all API requests render a `RequestLogItem` for transparency.

## Inputs
- `onLogRequest` (function): Callback to lift transparent execution logs up to the `ControlPanel`.

## Outputs
- `RequestLogItemProps` object emitted to `onLogRequest` upon API interaction.

## Dependencies
- `lucide-react` (Icons)
- `../common/StateWrapper`
- `./RequestLogItem`
- `../../api/client.js`

## Failure Modes
- API target unreachable: Component state switches to `error` and renders `StateWrapper` error fallback.
- Optimistic update failure: User message is removed from the local list to prevent "ghost" messages.
- Empty response parsing error: Caught and transitioned to `error` state.

## Limitations
- Does not persist state globally. If the component unmounts, the conversation is lost.
- Does not support file or image attachments.
