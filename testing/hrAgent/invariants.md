# HR Agent Invariants

## 1. Identity Invariants
- `staff_id` must be immutable once assigned.
- `staff_id` must follow the format `STF-XX`.
- `contact.primary` must always exist and be unique across all active staff.
- A staff member cannot be created if `contact.primary` matches an existing active staff member.
- `status` must be either `ACTIVE` or `TERMINATED` (or other valid states if defined later).
- Terminated staff cannot be marked as `ACTIVE` without a new hiring process (re-hire creates new ID or explicit reactivation logic - strictly: `status` transition `TERMINATED` -> `ACTIVE` is forbidden).

## 2. Compensation Invariants
- A `salary_card` must exist before any `process_salary` (Finance) action can occur for a staff member.
- `base_salary` must be a non-negative number.
- `effective_from` date in a salary card must be valid (not null).
- `incentives.amount_per_unit` must be non-negative.
- `salary_card` updates must preserve history of previous versions (append-only history).

## 3. Leave Invariants
- `start_date` must be less than or equal to `end_date`.
- Leave dates cannot overlap with existing approved/pending leaves for the same staff ID.
- Leave cannot be recorded for a staff member who is `TERMINATED`.
- `leave_type` must be one of the allowed enum values (`ADVANCE`, `EMERGENCY`, `CASUAL`, `SICK`).

## 4. Finance Handshake Invariants
- Creation of a Salary Card must be available for Finance Agent retrieval.
- Updates to Salary Card must be reflected in subsequent `get_salary_card` calls.

## 5. Lifecycle Invariants
- **Hire**: A new staff member starts in `ACTIVE` state.
- **Terminate**: A staff member transitions from `ACTIVE` to `TERMINATED`.
- **Re-hire**: A terminated staff member cannot be directly transitioned back to `ACTIVE`. (Requires new hire or explicit re-activation policy, currently treated as new invariant: `TERMINATED` is a terminal state for that `staff_id` context).
- **Duplicate**: Two active staff members cannot share the same `contact.primary`.

## 6. Logic Invariants
- **Incentive Calculation**: `incentive_amount` = `metric_value` * `amount_per_unit`.
- **Termination Date**: `last_working_day` must be valid properly formatted date string.
