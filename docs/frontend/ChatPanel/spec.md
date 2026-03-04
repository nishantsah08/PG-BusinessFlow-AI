# ChatPanel Specification

## Purpose
The `ChatPanel` provides the primary user interface for text-based interaction with MasterAI. It acts as the conversational entry point for the system.

## Scope
- Capture user text input.
- Capture optional file/image attachments.
- Display a chronological history of the current interaction session.
- Manage optimistic updates for immediate perceived responsiveness and preserve uploaded image URLs for follow-up turns.
- Strictly enforce communication only through the designated `apiClient`.
- Strictly enforce the 5-states visual requirements using `StateWrapper`.
- Ensure all API requests render a `RequestLogItem` for transparency.
- Render assistant image responses as a horizontal strip with modal lightbox navigation.

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
- Tiny/invalid image uploads may be skipped by backend validation and therefore not appear in returned property image sets.

## Limitations
- Chat history is frontend-session scoped and resets on explicit "New Chat".
- Lightbox blocks background interaction by design until closed.
