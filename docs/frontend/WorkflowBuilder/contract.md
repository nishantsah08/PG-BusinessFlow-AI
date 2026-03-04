# WorkflowBuilder Contract

## Props
- `workflow` (Object|null): The workflow definition to edit. `null` means create mode.
- `onSave` (function): `(data: WorkflowDefinition) => void` — called on form submit.
- `onCancel` (function): `() => void` — called when cancel or X is clicked.

## Internal State
- `workflowId`, `name`, `description`, `triggerEvent`, `steps[]`, `errors{}`.

## Emitted Data Shape (onSave)
```json
{
  "workflow_id": "string",
  "name": "string",
  "description": "string (required)",
  "trigger_event": "string",
  "steps": [{ "step_id": "", "description": "", "agent": "", "tool": "", "params": {}, "on_failure": "retry|compensate|abort" }]
}
```
