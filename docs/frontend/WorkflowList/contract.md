# WorkflowList Contract

## Props
- `workflows` (Array, default `[]`): Workflow definition objects.
- `selectedId` (string|null): ID of the currently selected workflow.
- `onSelect` (function): `(workflow) => void`.
- `onDelete` (function): `(workflow_id) => void`.
- `onCreateNew` (function): `() => void`.
