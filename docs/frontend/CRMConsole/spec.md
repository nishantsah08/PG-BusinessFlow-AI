# CRMConsole Specification

## Purpose
Provide an overview-first CRM operations console on route `/crm`, separating business overview from lead search and opening lead detail in a right-side drawer.

## Scope
- Render overview KPIs (`Leads`, `Enquiry`, `Visited`, `Onboarded`, `Left`, `Pending Follow-up`).
- Render overview analytics and full-width merge review queue.
- Render `Overview` and `Leads` workspace tabs.
- Render searchable lead list and right-side lead drawer.
- Render timeline with type filters (`ALL`, `SESSION`, `STATUS_CHANGE`, `NOTE`, `MERGE`, `ARTIFACT_LINKED`).
- Support inline safe edits only for approved snapshot/requirement fields.
- Allow merge approval from GUI only for roles with `merge_leads` permission.

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
- Current mutation UI is intentionally scoped to low-risk snapshot/status edits plus CEO-approved merge execution.
- Merge queue depends on backend system-flagged candidates from `get_merge_candidates`.
