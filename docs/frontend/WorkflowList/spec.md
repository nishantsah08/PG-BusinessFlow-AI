# WorkflowList Specification

## Purpose
Renders the SOP list table inside the `SOPs` module.

## Scope
- Display each visible SOP as one full-width row with:
  - business state: `Active`, `Draft`, or `Archived`
  - SOP name
  - business outcome summary
  - updated timestamp
  - `Open` action
- Support top-level filtering through `Active`, `Draft`, `Archived`, and `All`.
- Support search across SOP name and readable SOP text.
- Open the SOP in the full-screen SOP workspace.
- Keep cloning, versioning, and publish history out of the list view.
- Show an empty state when no SOPs match the current filter.

## Inputs
- `workflows` (Array): list of workflow definition objects.
- `selectedId` (string|null): currently selected workflow ID.
- `onSelect(workflow)` callback.

## Dependencies
- `lucide-react`: `Search`, `Filter`, `Plus` icons.
