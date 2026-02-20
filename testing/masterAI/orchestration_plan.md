# MasterAI Orchestration Test Plan

This document defines **Multi-Agent Flows** to test coordination.

## 1. Defining a Flow Test
Each Orchestration Test must specify:
*   **Start State**: Initial Context.
*   **Event Sequence**: `[Evt1, Evt2, ...]`.
*   **Expected End State**: Final Workflow Status.
*   **Expected Logs**: "Step 1: Success", "Step 2: Failed".
*   **Expected Events**: `payment.processed`, `email.sent`.

## 2. Example: "Tenant Onboarding" Flow
*   **Start**: `Context.Applicant` (Approved).
*   **Trigger**: `payment.received` (Deposit).
*   **Sequence**:
    1.  MasterAI -> `Finance.record_txn` (Mock: Success).
    2.  MasterAI -> `Property.assign_unit` (Mock: Success).
    3.  MasterAI -> `CRM.convert_to_tenant` (Mock: Success).
    4.  MasterAI -> `Chat.send_welcome` (Mock: Success).
*   **End State**: `Workflow.COMPLETED`, `Context.Role = Tenant`.

## 3. Example: "Payment Failure" Flow
*   **Start**: `Context.Applicant`.
*   **Trigger**: `payment.received` (Failed Transaction).
*   **Sequence**:
    1.  MasterAI -> `Finance.record_txn` (Mock: Failure).
    2.  MasterAI -> `Chat.send_error` (Mock: Success).
*   **End State**: `Workflow.FAILED`, `Context.Role = Applicant` (No change).

## 4. Failure-Recovery Validation Rules

Since Phase-2, every orchestration test must additionally assert the following properties. These are mandatory — a test that validates only the happy-path sequence without checking recovery properties is incomplete.

### Required Assertions

1.  **Rollback Correctness**: If a workflow defines compensation steps and fails mid-execution, the test must assert:
    *   Final status is `ROLLED_BACK` (not `FAILED`)
    *   Compensation steps executed in reverse order
    *   Compensation history entries match the completed steps

2.  **Lock Release**: If any step in the workflow acquires a resource lock, the test must assert:
    *   Locks are released after workflow completion (`COMPLETED` or `ROLLED_BACK`)
    *   Locks are released after workflow failure (`FAILED` or `COMPENSATION_FAILED`)
    *   No orphaned locks remain in `getGlobalState().locks`

3.  **Deadline Compliance**: If a workflow defines a deadline, the test must assert:
    *   Workflow fails with `DEADLINE_EXPIRED` when clock advances past deadline
    *   No steps execute after deadline expiry
    *   Agents are not called after deadline

4.  **No Duplicate Execution**: If the same event triggers the same workflow, the test must assert:
    *   `processEvent()` returns `{ duplicate: true }` on second call
    *   Agent call counts do not increase
    *   No new workflow instances are created
