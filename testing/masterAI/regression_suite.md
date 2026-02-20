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

---

## 6. Phase-3 Integration Validation Conditions

A test passes **only if ALL** of the following match the scenario's "Expected Integration Result" in `scenario_library.md`:

| # | Condition | Assertion |
|:--|:----------|:----------|
| 1 | **Expected agents called** | Exact set of agents invoked, no extra, no missing |
| 2 | **Correct order** | Agent call sequence matches expected chain exactly |
| 3 | **Correct final state** | Workflow status, resource states, and data mutations match |
| 4 | **Correct user output** | Kalyani's response content and persona integrity verified |
| 5 | **No invariant broken** | All invariants from `invariants.md` §1–§6 hold throughout execution |

### System Invariants (Always Enforced)
These invariants from `invariants.md` must hold during **every** integration test, regardless of scenario:
*   §1: Workflow Integrity (Atomic, No Zombies, Deterministic Order)
*   §2: Communication Discipline (Hub-and-Spoke, Event Causality)
*   §3: Data Consistency (Event Correlation, Append-Only)
*   §4: Operational Boundaries (Timeout, Error Containment)
*   §5: Security & Persona (Persona Integrity)
*   §6: Phase-2 Runtime Guarantees (Idempotency, Locks, Rollback, Replay, Deadline, Timeout, Session)

**If any invariant is violated — even if all 5 conditions above pass — the test FAILS.**

---

## 7. Phase-3 Failure Reporting Format

When a test fails, log the following structure:

```
Scenario:           [SCN-XXX ID and name]
Expected:           [Expected behavior from scenario_library.md]
Actual:             [Observed behavior during test]
Mismatch Type:      [agent_call | order | state | output | invariant]
Probable Cause:     [Initial diagnosis of why the mismatch occurred]
```

### Mismatch Type Reference
| Type | Meaning |
|:-----|:--------|
| `agent_call` | Wrong agents called, or missing/extra agent invocations |
| `order` | Agents called in wrong sequence |
| `state` | Final workflow/resource/data state differs from expected |
| `output` | User-visible message incorrect or exposes internals |
| `invariant` | System invariant from `invariants.md` violated |

---

## 8. Phase-3 Priority Scenarios (First Wave)

Execute **only** these scenarios first. Do not run the full suite until these pass:

| Priority | Scenario | Reference |
|:---------|:---------|:----------|
| 1 | **Booking Flow** | `SCN-001: Successful End-to-End Booking` |
| 2 | **Payment Flow** | `SCN-ERR-001: Payment Gateway Timeout` + `SCN-EDGE-001: Duplicate Webhook` |
| 3 | **Onboarding** | `SCN-ERR-003: Rollback on Critical Failure` + `SCN-P2-003: Compensation Recovery` |
| 4 | **Maintenance Request** | `SCN-002: Maintenance Request via Chat` |

### Rationale
These four flows cover:
*   Happy path (booking, maintenance)
*   Failure & recovery (payment timeout, rollback)
*   Edge cases (duplicate webhook)
*   Compensation (onboarding rollback)

Remaining scenarios are executed only after all priority scenarios pass.

---

## 9. Phase-3 Completion Criteria

The integration testing phase is **complete** only when ALL of the following are true:

- [ ] All priority scenarios (§8) pass
- [ ] All remaining scenarios pass
- [ ] No invariant from `invariants.md` §1–§6 violated across any test
- [ ] No crashes occur in MasterAI or any agent during testing
- [ ] Final test report (§10) delivered

---

## 10. Phase-3 Final Test Report Format

When integration testing concludes, the final report must contain:

```
Scenarios tested:       [count]
Pass count:             [count]
Fail count:             [count]
Invariant violations:   [list or "None"]
Observed anomalies:     [list or "None"]
Recommended fixes:      [list or "None — all tests pass"]
```

