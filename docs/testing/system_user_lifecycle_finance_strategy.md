# System User Life Cycle Test Strategy (Finance Determinism)

## Objective

Enforce deterministic financial behavior across the full user lifecycle by requiring all finance mutations to run through predefined workflows.

## Scope

This strategy applies to:

- Tenant onboarding financial contract setup
- Monthly billing generation
- Incoming payment posting
- Outgoing expense posting
- Salary payout posting
- Manual ledger debit creation

Read-only finance queries are out of scope for workflow enforcement.

## Actor Model

The lifecycle tests must include interactions from multiple business roles:

- Tenant (payment and billing context)
- Caretaker (field-side operations input)
- Sales (MasterAI / Kalyani)
- CEO (manual bank confirmation authority)

## Deterministic Workflow Rule

Finance mutation actions must map to fixed workflow IDs:

- `onboard_tenant_contract` -> `finance_onboard_tenant_contract_v1`
- `generate_monthly_bills` -> `finance_generate_monthly_bills_v1`
- `add_ledger_entry` -> `finance_add_ledger_entry_v1`
- `record_incoming_txn` -> `finance_record_incoming_txn_v1`
- `record_outgoing_txn` -> `finance_record_outgoing_txn_v1`
- `process_salary_payout` -> `finance_process_salary_payout_v1`

Direct ad-hoc mutation paths are non-compliant.

## User-View Requirement

Each predefined finance workflow must expose plain-English pseudo-code for business users:

- `user_view_title`
- `user_view_steps` (ordered, concise business steps)

This is required so finance operations are transparent to non-technical stakeholders.

## Payment Governance Rule

All finance mutation workflows require CEO authorization before execution:

- If authorization is not present, the system must return `PENDING_CEO_AUTHORIZATION`.
- Non-CEO approval attempts must be rejected.
- Only CEO-approved requests can execute deterministic finance workflows.
- Incoming payments additionally require CEO bank-statement confirmation before posting.

## Carry-Forward Rule

Overpayment handling must be deterministic:

- If incoming payment exceeds currently allocatable dues, the remainder becomes `carry_forward`.
- `carry_forward` becomes eligible from the next month onward.
- During `generate_monthly_bills`, eligible credit is auto-applied to newly generated month entries and reported as `applied_carry_forward`.

## Test Placement

Lifecycle finance tests are stored in:

- `testing/masterAI/lifecycle_tests/`
- `testing/masterAI/lifecycle_tests/customer_lifecycle_employee_mix.test.js` (customer lifecycle with employee mix)

MasterAI orchestration regression tests remain in:

- `testing/masterAI/generated_tests/`

Finance deterministic allocation tests are stored in:

- `testing/financeAI/generated_tests/carry_forward_allocation.test.js`

## Minimum Pass Gates

A lifecycle finance suite passes only when:

1. Predefined finance workflows exist and are marked deterministic/protected.
2. Plain-English user-view fields are present for each finance workflow.
3. Incoming payment is blocked without CEO confirmation.
4. Incoming payment succeeds after CEO confirmation and returns deterministic workflow metadata.
5. Multiple employee roles can trigger allowed finance operations through predefined workflows.
6. Sales-initiated finance requests execute only after CEO authorization.
7. Parallel multi-actor execution remains isolated and deterministic.
8. Overpayment surplus is carried forward and auto-applied from the next eligible month only.
