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

---

## 5. Phase-3 Integration Test Execution Rules

Phase-3 transitions from mocked/simulated testing to **real agent integration**. The following rules govern all integration test runs.

### Agents Under Test
All agents are invoked locally as real instances:
*   **CRM** — Lead & Tenant management
*   **Property** — Inventory & Asset management
*   **Finance** — Ledger & Transaction management
*   **HR** — Staff & Compensation management
*   **Communications** — Message gateway
*   **MasterAI** — Orchestrator (the system under test)

### Execution Rules
1.  **MasterAI is the sole caller** — No agent may be invoked directly by the test harness. All agent calls must flow through MasterAI's LogicEngine. This enforces `invariants.md §2: Hub-and-Spoke Only`.
2.  **Real responses** — Agents return real data, not mocks. Test validation compares against `scenario_library.md` expected integration results.
3.  **No mutation of agents** — Agent code, workflows, and LogicEngine are read-only during integration testing. Fixes come after the test report.
4.  **Clean state per test** — Each test starts with a reset system state. No test depends on side-effects of a previous test.

---

## 6. Phase-3 Test Procedure (Strict Order)

For **every** scenario in `scenario_library.md`, follow this exact sequence:

| Step | Action | Detail |
|:-----|:-------|:-------|
| 1 | **Reset system state** | Clear all workflows, sessions, locks, ledger entries, CRM data, and processed event IDs |
| 2 | **Start MasterAI** | Initialize LogicEngine with all workflows loaded |
| 3 | **Trigger event** | Inject the scenario's trigger event (e.g., `message.received`, `payment.received`) |
| 4 | **Observe execution** | Record all agent calls, state transitions, and outputs in real time |
| 5 | **Compare with expected result** | Diff observed behavior against the scenario's "Expected Integration Result" block |
| 6 | **Record pass/fail** | Log result with full trace. If ANY field mismatches → test FAILS |

**Execution order is strict.** Steps cannot be reordered, parallelized, or skipped.

---

## 7. Phase-3 Logging Requirements

During every integration test, capture and store the following data:

| Log Category | What to Capture | Format |
|:-------------|:----------------|:-------|
| **Events** | All incoming events with `event_id`, `type`, `timestamp`, `payload` | JSON |
| **Workflow Transitions** | Every status change: `CREATED` → `RUNNING` → `COMPLETED`/`FAILED`/`ROLLED_BACK` | JSON with `workflow_id`, `from_status`, `to_status`, `timestamp` |
| **Tool Calls** | Every agent invocation: `agent`, `tool`, `args`, `response`, `duration_ms` | JSON |
| **Agent Responses** | Full response payload from each agent | JSON |
| **Errors** | Exception type, message, stack trace, containing workflow/step | JSON |
| **Latency** | Per-tool-call duration, total workflow duration, end-to-end scenario duration | Numeric (ms) |

**Rule**: If observed behavior differs from `scenario_library.md` expected outcome in **any** field → the test **fails**. Partial matches are not passes.

