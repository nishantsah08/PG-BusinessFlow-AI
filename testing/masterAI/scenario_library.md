# MasterAI Scenario Library

## 1. Happy Path Scenarios
*   **SCN-001: Successful End-to-End Booking**
    *   User asks for room -> MasterAI checks availability -> User confirms -> MasterAI books -> Payment received -> Booking confirmed.
*   **SCN-002: Maintenance Request via Chat**
    *   Tenant reports leak -> MasterAI logs ticket -> MasterAI confirms proactively.

## 2. Failure & Resilience Scenarios
*   **SCN-ERR-001: Payment Gateway Timeout**
    *   User pays -> Webhook delayed > 60s -> MasterAI queries status -> Finds success -> Reconciles manually.
*   **SCN-ERR-002: Agent Crash During Flow**
    *   Booking Flow Step 2 (Property Check) succeeds -> Step 3 (Payment Link) fails (Agent Crash) -> MasterAI retries 3x -> MasterAI informs user of technical difficulty.
*   **SCN-ERR-003: Rollback on Critical Failure**
    *   Tenant Onboarding: Lease Signed (Success) -> Payment Failed (Fail) -> MasterAI Voids Lease (Compensation).

## 3. Edge Cases
*   **SCN-EDGE-001: Duplicate Webhook**
    *   Payment `evt_123` received -> Processed.
    *   Payment `evt_123` received AGAIN -> MasterAI detects duplicate -> Ignores, returns Idempotency Key.
*   **SCN-EDGE-002: Replayed Event Stream**
    *   Replay yesterday's logs -> System state should **not** change (Idempotency check).
*   **SCN-EDGE-003: Race Condition**
    *   "Cancel Booking" and "Confirm Payment" events arrive milliseconds apart. System must lock and process sequentially.

## 4. Phase-2 Determinism Scenarios

These scenarios validate engine-level resilience guarantees added in Phase-2. All use deterministic clock and parallel execution — no real-time delays.

*   **SCN-P2-001: Duplicate Event Replay**
    *   Payment webhook `EVT-PAY-42` fires -> workflow completes -> same webhook fires again.
    *   Engine returns `{ duplicate: true }` -> no agents called -> state snapshot unchanged.
    *   Validates: `invariants.md §6: Duplicate Event Idempotency`.

*   **SCN-P2-002: Parallel Conflicting Workflows**
    *   Two users attempt to book unit A101 simultaneously via `runParallel()`.
    *   First workflow acquires `lock:unit:A101` -> succeeds -> lock released.
    *   Second workflow receives `LOCK_CONFLICT` -> fails -> no Property agent call.
    *   Validates: `invariants.md §6: Locked Resource Exclusion`.

*   **SCN-P2-003: Compensation Recovery**
    *   Tenant onboarding: assign unit (✔) -> create ledger (✔) -> send notification (✖ crash).
    *   Engine runs compensation in reverse: undo ledger -> undo assignment.
    *   Final status: `ROLLED_BACK`. All compensation entries recorded.
    *   Validates: `invariants.md §6: Workflow Rollback Integrity`.

*   **SCN-P2-004: Expired Workflow Execution Attempt**
    *   Workflow defined with 5-second deadline -> clock advanced 6 seconds via `advanceTime()`.
    *   Engine checks deadline before first step -> fails with `DEADLINE_EXPIRED`.
    *   No agents called. No steps executed.
    *   Validates: `invariants.md §6: Expired Workflow Immutability`.
