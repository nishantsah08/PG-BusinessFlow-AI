# WorkflowBuilder Specification

## Purpose
Legacy lower-level authoring form. It is not the active CEO-facing SOP surface.

## Scope
- The active business surface is the `SOPs` workspace:
  - left side: readable SOP document
  - right side: SOP-scoped assistant chat
  - top actions: `Save Draft`, `Validate`, `Publish`, `Archive`
- SOP governance is GUI-only.
- WhatsApp may list, explain, and review validation for SOPs.
- WhatsApp must not create, edit, clone, publish, or archive SOPs.
- If this component is used again in future, it remains a lower-level internal authoring surface rather than the primary business review surface.

## Inputs
- `workflow` (Object|null): workflow to edit, or null for create mode.
- `onSave(data)`: callback with the form data.
- `onCancel()`: callback to close the builder.

## Dependencies
- `lucide-react`: `Save`, `X`, `Trash2`, `ChevronUp`, `ChevronDown`, `Code` icons.
- `DeveloperModeContext`: Conditionally renders the technical configuration in step-level developer toggle.
