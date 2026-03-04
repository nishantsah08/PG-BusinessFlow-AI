# WorkflowList Decisions

- **Inline delete confirmation over modal**: Chose an overlay on the card itself to keep the user's focus on the item being deleted, avoiding a full-screen modal.
- **Hover-reveal actions**: Edit and Delete buttons only appear on hover to keep the UI clean, with click-through prevented via `stopPropagation`.
