# MasterAI Testing Philosophy

## 1. Governance
This document **extends** the global testing philosophy defined in `testing/philosophy.md`. It does **not** override any global principles. All global rules regarding atomic reliability, deterministic execution, and log integrity apply here with equal force.

## 2. Orchestrator-Class Testing
MasterAI is the "Brain" of the system. Testing a brain requires a different approach than testing a limb (Agent).

**Definition**: Orchestrator-Class Testing verifies the **correctness of decisions** and the **integrity of state transitions**, rather than the execution of the tasks themselves.

### Core Tenets
1.  **Decision > Action**: We test *why* MasterAI chose to call `PaymentAgent`, not *how* `PaymentAgent` processed the payment.
2.  **State is Sacred**: The correctness of the system is defined by the validity of the `Session` and `Workflow` state objects at any given millisecond.
3.  **Time is a Variable**: Tests must manipulate time to verify timeouts and scheduled events. Waiting for real-time is forbidden.
4.  **Agents are Abstractions**: In this suite, Agents are treated as reliable (or reliably failing) black boxes. We mock their contracts, not their logic.

## 3. The "Black Box Brain" Approach
We test MasterAI by feeding it **Events** and **Context**, and asserting on the resulting **Decisions** (Tool Calls) and **State Changes**. We do not peek at internal variables unless debugging.

## 4. Zero Flake Tolerance
Because MasterAI coordinates the entire system, any flakiness in its test suite undermines confidence in the whole platform. Flaky tests in `testing/masterAI` are treated as critical bugs effectively blocking deployment.

## 5. Engine Guarantees (Phase-2)

Phase-1 testing validated **decision correctness** — that MasterAI calls the right agent at the right time. Phase-2 extends this to **runtime safety** — that the engine itself enforces distributed-system invariants.

System correctness now depends on these engine-level guarantees:

1.  **Idempotent Event Processing**: Duplicate events (same `event_id`) must never produce duplicate state changes. The engine tracks processed events and silently rejects replays. This enforces *State is Sacred* (§2.2) at the infrastructure level.
2.  **Deterministic Concurrency**: Parallel workflows competing for the same resource are serialized via resource locking. Only one workflow may hold a lock; the other fails with `LOCK_CONFLICT`. No non-deterministic race outcomes.
3.  **Compensation-Based Rollback**: Failed workflows must fully undo completed steps via reverse compensation. Final status is `ROLLED_BACK` (all undone) or `COMPENSATION_FAILED` (escalated to human). There is no `PARTIAL_SUCCESS`.
4.  **Deadline Enforcement**: Workflows may declare an absolute deadline. The engine checks the deadline before each step and fails with `DEADLINE_EXPIRED` if past. This enforces *Time is a Variable* (§2.3) as a first-class engine concept.
5.  **Step Timeout**: Individual tool calls are wrapped in a timeout. Exceeding it causes `STEP_TIMEOUT` failure — the engine never waits indefinitely.
6.  **Resource Locking**: Steps may declare required locks (`locks: ['unit:A101']`). The engine acquires locks before execution and releases them on workflow completion or failure.
7.  **Session Expiry**: Sessions have a TTL. The engine checks expiry against the (overridable) system clock and transitions expired sessions to `EXPIRED` status.

### Relationship to Phase-1 Tenets
These guarantees operationalize the Phase-1 philosophy:
*   **Decision > Action** still holds — but now we also test that the engine *prevents* incorrect state, not just that it *chooses* correct actions.
*   **State is Sacred** is now enforced by idempotency tracking and compensation rollback at the engine level.
*   **Time is a Variable** is now enforced by deadline/timeout/session expiry logic, all testable via deterministic clock override.

## 6. Phase-3 Integration Testing Constraints

Phase-3 moves from simulated/mocked testing to **real agent integration**. The following constraints are absolute during this phase.

### Read-Only System Rule
During integration testing, the following components are **frozen** (read-only):

| Component | Modification Allowed? | Rationale |
|:----------|:---------------------|:----------|
| `LogicEngine` | ❌ NO | Engine is the subject of testing, not modification |
| Workflows | ❌ NO | Workflow definitions must remain stable for repeatable tests |
| Agent code | ❌ NO | Agent behavior is what we are validating |
| Agent APIs | ❌ NO | API contracts are fixed for this phase |
| `invariants.md` | ❌ NO | Invariants are the laws; tests prove compliance |
| Test scenarios | ✅ YES (append only) | New expected results may be added, existing ones never modified |
| Test harness | ✅ YES (extend only) | New harness utilities may be added for integration support |

### Observe → Report → Fix (Strict Sequence)
1.  **Observe**: Run integration tests and record all behavior
2.  **Report**: Document all failures using the failure reporting format in `regression_suite.md §7`
3.  **Fix**: Implement fixes **only after** the full test report is delivered

**Fixes are NEVER applied during the testing phase.** This ensures the test report reflects the true state of the system, not a moving target.

### Phase-3 Extends, Does Not Replace
*   Phase-1 tenets (§2: Decision > Action, State is Sacred, Time is a Variable, Agents are Abstractions) remain in force.
*   Phase-2 engine guarantees (§5: Idempotency, Concurrency, Compensation, Deadline, Timeout, Locking, Session) remain in force.
*   Phase-3 adds **real agent validation** on top of the existing deterministic/simulation layers.

