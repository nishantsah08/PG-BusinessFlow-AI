# WorkflowBuilder Decisions

- **JSON textareas for params/validation_rules**: Chose free-form JSON over domain-specific UI to keep the builder generic and aligned with the `define_workflow` API's flexible schema.
- **Up/Down buttons over drag-and-drop**: Kept reorder simple with button-based movement to avoid additional library dependencies (no `react-beautiful-dnd`).
- **Client-side validation only**: Validation is done in-browser before submit. Server validation is a separate concern.
