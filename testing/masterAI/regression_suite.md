# MasterAI Regression Suite

These tests are permanent sentinels. Any failure here is a **Deployment Blocker**.

## 1. Core Invariants (Sanity)
*   **INV-001**: System boots without crash.
*   **INV-002**: `LogicEngine` loads all 50+ defined workflows.
*   **INV-003**: Event Bus routes messages correctly (mock publish -> subscribe).

## 2. Critical User Journeys (CUJs)
*   **REG-001**: Full "Happy Path" Tenant Onboarding (End-to-End with Mocks).
*   **REG-002**: Full "Happy Path" Maintenance Ticket Logic.
*   **REG-003**: Full "Happy Path" Staff Hiring Flow.

## 3. Security & Safety
*   **SEC-001**: Attempt to access Admin Tools as "Tenant" role -> `AccessDenied`.
*   **SEC-002**: Injection attempt in `Chat` input -> Sanitized/Handled.

## 4. Performance Baselines
*   **PERF-001**: 100 Concurrent Workflows (Simulated) -> No crash, Avg latency < 200ms (Internal logic).

## 5. Phase-2 Safety Sentinels

These tests are **deployment blockers** — identical in severity to §1 Core Invariants. A failure in any sentinel means the engine's runtime safety guarantees are broken.

*   **P2-SENT-001: Duplicate Event Idempotency**
    *   Submit `event_id: EVT-X` twice via `processEvent()`.
    *   Assert: second call returns `{ duplicate: true }`, agent call count = 1, no new workflow instance.
    *   Failure means: duplicate state corruption is possible in production.

*   **P2-SENT-002: Rollback Integrity**
    *   Run a 3-step workflow where step 3 fails. Steps 1-2 have compensation defined.
    *   Assert: status = `ROLLED_BACK`, compensation history has 2 entries in reverse order, all `UNDONE`.
    *   Failure means: partial state survives failures — data inconsistency in production.

*   **P2-SENT-003: Lock Safety**
    *   Run two parallel workflows both declaring `locks: ['unit:X']` via `runParallel()`.
    *   Assert: exactly one `COMPLETED`, exactly one `FAILED` with `LOCK_CONFLICT`, zero orphaned locks.
    *   Failure means: concurrent resource corruption is possible in production.

*   **P2-SENT-004: Deadline Enforcement**
    *   Define workflow with deadline, advance clock past deadline, execute workflow.
    *   Assert: status = `FAILED` with `DEADLINE_EXPIRED`, zero agent calls, zero steps executed.
    *   Failure means: expired workflows can execute stale operations in production.
