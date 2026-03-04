# CRMConsole Specification

## Purpose
Provide a Lead 360 operations console for CRM on route `/crm`, combining current snapshot edits with append-only timeline review.

## Scope
- Render lead KPI strip (total + lifecycle buckets).
- Render searchable lead list and single-lead detail panel.
- Render timeline with type filters (`ALL`, `SESSION`, `STATUS_CHANGE`, `NOTE`, `MERGE`, `ARTIFACT_LINKED`).
- Support allowed Admin Adapter mutations: `update_lead_snapshot` (email), `change_status` (reason-required), `add_manual_note`, `add_secondary_phone`.
- Soft-lock high-risk actions (merge/archive) based on backend-provided permissions.

## Inputs
None via props. Uses authenticated context and internal component state.

## Outputs
- Read operations and mutations through `/api/master_ai/tools/execute` with `agent_name=CRMAgent`.
- UI-level confirmation for status changes before mutation execution.

## Dependencies
- `apiClient`
- `AuthContext` (`/api/auth/context` derived role + permissions)
- `lucide-react`

## Failure Modes
- Any failed read/mutation surfaces inline error and preserves page operability.
- Empty search/timeline states render explicit empty text without route failure.

## Limitations
- Current mutation UI is intentionally scoped to low-risk one-off CRM changes.
- High-risk actions remain permission-gated and non-executable from this surface by default.
