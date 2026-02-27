# WorkflowsPage States

- **Loading**: `StateWrapper` shows spinner while fetching from API.
- **Success**: Both panels rendered — list on left, builder/placeholder on right.
- **Empty**: `StateWrapper` shows empty message with prompt to create first workflow.
- **Error**: `StateWrapper` shows error message with retry button.
- **Creating/Editing**: Right panel shows `WorkflowBuilder` form; left panel narrows.
- **Idle**: Right panel shows prompt to select or create a workflow.
