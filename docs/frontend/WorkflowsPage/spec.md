# WorkflowsPage Specification

## Purpose

Route-level SOP control plane hosted at `/workflows`.

This page is the only governance surface for business procedure drafting, validation, publish, and archive actions.

## Scope

- Present a full-width SOP list with filters:
  - `Active`
  - `Draft`
  - `Archived`
  - `All`
- Present a full-screen SOP workspace when one SOP is opened.
- Left side shows a business-readable SOP document.
- Right side shows a normal LLM chat window scoped to the selected SOP only.
- Top actions support:
  - `Save Draft`
  - `Validate`
  - `Publish`
- New SOP creation starts with:
  - blank SOP text
  - blank SOP chat thread
- Governance actions do not happen through WhatsApp or free-floating MasterAI chat.

## Inputs

None directly. Data is loaded from the workflow governance API.

## Dependencies

- `apiClient` for SOP/workflow governance operations
- `useUI` for success and error notices
- SOP list and SOP workspace child surfaces
