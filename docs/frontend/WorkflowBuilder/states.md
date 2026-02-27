# WorkflowBuilder States

- **Create Mode** (`workflow` is null): Empty form, `workflow_id` is editable, Save button shows "Create Workflow".
- **Edit Mode** (`workflow` is provided): Pre-filled form, `workflow_id` is read-only (disabled).
- **Preview Mode**: Form inputs are disabled via `<fieldset>`, natural language steps are shown. User must click "Manual Override" to edit.
- **Developer Mode**: When globally enabled in settings, technical inputs (`workflow_id`, `trigger_event`, JSON params) can be edited via `<details>` toggles. Completely hidden otherwise.
- **Validation Error**: Red borders on invalid fields, error messages shown below inputs.
