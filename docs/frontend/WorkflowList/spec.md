# WorkflowList Specification

## Purpose
Renders a scrollable list of workflow definition cards with select, delete, and create actions.

## Scope
- Display each workflow as a card using the natural language `name` and `description` as primary text (falling back to `workflow_id` and `trigger_event` if unavailable).
- Click to select for editing.
- Delete with inline confirmation overlay.
- "New Workflow" create button at bottom.
- Empty state when no workflows exist.

## Inputs
- `workflows` (Array): list of workflow definition objects.
- `selectedId` (string|null): currently selected workflow ID.
- `onSelect(workflow)`, `onDelete(id)`, `onCreateNew()` callbacks.

## Dependencies
- `lucide-react`: `GitBranch`, `Trash2`, `Edit3`, `Plus`, `Zap` icons.
