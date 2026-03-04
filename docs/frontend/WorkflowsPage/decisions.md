# WorkflowsPage Decisions

- **Two-panel layout over tabs**: Chose a side-by-side layout (list + builder) to allow quick switching between workflows without losing context, matching the `ControlPanel` pattern.
- **API-backed state over local-storage**: Even in Phase 1, workflows are persisted to `data/workflows.json` via backend API for consistency with the system's Phase 1 data convention.
- **StateWrapper integration**: Reused the existing `StateWrapper` component for all 5 UI states rather than building custom loading/error UI.
