# WorkflowBuilder Specification

## Purpose
Form component for creating or editing a workflow definition. Supports dynamic step management (add, remove, reorder) and JSON parameter editing.

## Scope
- Main header emphasizes natural language `name` (formatted without underscores).
- Visible `description` textarea — required field. MasterAI uses this to decide when to trigger the workflow.
- Trigger info block explains 3 trigger mechanisms: system event, timer, or MasterAI decision.
- Technical fields (`workflow_id`, `trigger_event`) are managed internally but **not visible** in the form.
- Step management via Agent-First generation (no visual "Add Step" button). Existing steps can be removed or reordered.
- Natural Language Step rendering. Technical step attributes hidden behind step-level Developer Mode toggle (code icon).
- Client-side validation (required fields: `workflow_id`, `description`, `trigger_event`, valid JSON params).
- Two modes: create (empty form) and edit (pre-populated from prop).
- `workflow_id` is read-only in edit mode.

## Inputs
- `workflow` (Object|null): workflow to edit, or null for create mode.
- `onSave(data)`: callback with the form data.
- `onCancel()`: callback to close the builder.

## Dependencies
- `lucide-react`: `Save`, `X`, `Trash2`, `ChevronUp`, `ChevronDown`, `Code` icons.
- `DeveloperModeContext`: Conditionally renders the technical configuration in step-level developer toggle.
