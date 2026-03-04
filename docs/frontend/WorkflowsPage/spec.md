# WorkflowsPage Specification

## Purpose
Top-level page for defining, viewing, editing, and deleting business-process workflow definitions. Accessible at `/workflows`.

## Scope
- Two-panel layout: left = WorkflowList, right = WorkflowBuilder.
- Fetch workflow definitions from `GET /api/workflows`.
- CRUD operations via `apiClient` (create, update, delete).
- Adhere to 5-state rendering via `StateWrapper`.
- Toast notifications for success/error via `useUI`.

## Inputs
None directly. Data fetched from `/api/workflows`. User input via child components.

## Dependencies
- `apiClient` for all data operations.
- `StateWrapper` for loading/error/empty states.
- `useUI` context for toast notifications.
- `WorkflowList` and `WorkflowBuilder` child components.
