# WorkflowsPage Contract

## Props
None. Route-level page component.

## Context hooks
- `useUI()` — for `addNotification` toast system.
- Uses `apiClient` (imported module, not a hook).

## Child Components
- `WorkflowList` — receives `workflows[]`, `selectedId`, `onSelect`, `onDelete`, `onCreateNew`.
- `WorkflowBuilder` — receives `workflow` (object|null), `onSave`, `onCancel`.
