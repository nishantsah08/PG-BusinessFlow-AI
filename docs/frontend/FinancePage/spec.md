# FinancePage Specification

## Purpose
Provide a first-class finance operations module on route `/finance` with governed transaction workflows.

## Scope
- Render role-aware Finance sections with section navigation:
  - Overview
  - Incoming Transactions
  - Outgoing Transactions
- Vendors
- Activity
- Show booking-hold and onboarding-from-booking flows inside Finance.
- Open workflow-backed business forms as blocking modals using the shared form/popup policy.
- Execute reads/mutations through Admin Adapter path via `/api/master_ai/tools/execute`.

## Inputs
None via props. Uses authenticated context and internal state.

## Outputs
- Overview: `get_financial_summary`, `list_pending_financial_workflow_requests`.
- Incoming: `get_incoming_txns`, `record_incoming_txn`, `get_booking_holds`, `record_booking_hold`, `complete_onboarding_from_booking`.
- Outgoing: `get_expenses`, `record_outgoing_txn`.
- Vendors: `get_vendors`, `add_vendor`, vendor-linked outgoing tracking.
- Button contracts: `GET /api/finance/button-contracts` for effective workflow linkage and per-button context contract (`context_keys`, `required_context_keys`, `any_of_context_keys`, `field_schema`).

## Smart Behavior (Finance Buttons)
- Forms are contract-driven from effective SOP/workflow mapping; known fields are shown/hidden by contract keys.
- If SOP/workflow introduces a new context key, Finance renders a generic input from `field_schema` and includes it in payload only when present.
- Submit payload is filtered to active contract `context_keys` before execution.
- `Add Incoming`
  - Payer supports search by name or phone.
  - Linked unit and property stay context-consistent (property filters unit options).
- `Record Booking Hold`
  - Linked unit is optional at hold time.
  - Unit may be changed later during final onboarding without losing booking-hold audit trail.
- `Complete Onboarding`
  - Booking hold selection pre-fills payer/property/unit/deposit context.
  - Final assigned unit can override earlier linked unit.
- `Add Outgoing`
  - Requires property and paid amount.
  - Requires either registered vendor or direct payee.
  - Work context supports existing work order or new work title/details.
- `Add Vendor`
  - Requires vendor name.
  - Optional identity/payment fields can be captured and reused in outgoing flow.

## Failure Modes
- Permission/workflow failures surface as inline business notices.
- Finance forms stay disabled until CEO reference data is loaded.
