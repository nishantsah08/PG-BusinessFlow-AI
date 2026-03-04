# HR Agent Regression Suite

## Philosophy
Every invariant violation discovered or potential bug fixed must have a permanent regression test.

## Permanent Regression Tests
The following scenarios are locked and must pass for every build:

1.  **Identity Integrity**:
    -   `test_hiring_duplicate_contact_fails`: Attempting to hire a staff member with a phone number that is already active MUST fail.
    -   `test_terminology_state_lock`: A terminated staff member MUST NOT be accessible via `get_all_staff(status='ACTIVE')`.

2.  **Financial Safety**:
    -   `test_salary_non_negative`: Creating a salary card with negative base salary MUST fail.
    -   `test_incentive_calculation_accuracy`: `calculate_incentive(metric=10, rate=350)` MUST return `3500`.

3.  **Leave Logic**:
    -   `test_leave_date_validation`: Recording a leave where `end_date < start_date` MUST fail.
    -   `test_leave_overlap_rejection`: Recording a leave that overlaps with an existing leave MUST fail.

4.  **Workflow Integrity**:
    -   `test_termination_blocks_leave`: Recording a leave for a `TERMINATED` staff member MUST fail.

## Updates
- Any future bug in HR logic must add a test case here before fixing the code.
