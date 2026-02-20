# MasterAI System Invariants

The following rules are **Laws of Physics** for the MasterAI system. No test is considered passing if any of these invariants are violated, even for a microsecond.

## 1. Workflow Integrity
*   **Atomic Transactions**: A workflow is either `COMPLETED` or `ROLLED_BACK`. There is no `PARTIAL_SUCCESS` state.
*   **No Zombie Flows**: A workflow cannot remain in `RUNNING` state indefinitely. It must eventually transition to `COMPLETED`, `FAILED`, or `PAUSED`.
*   **Deterministic Step Order**: Steps within a workflow must execute in the exact order defined, unless a branching rule explicitly alters the path.

## 2. Communication Discipline
*   **Hub-and-Spoke Only**: MasterAI is the only entity that can invoke Tools on Agents. Agents **never** call each other directly.
*   **Event Causality**: Every `Tool Call` must be traceable to a specific `Trigger Event` or `Workflow Step`. Spontaneous tool calls are forbidden.

## 3. Data Consistency
*   **Event Correlation**: Every log, decision, and side-effect produced during a session must bear the `session_id` and `trace_id` of the initiating event.
*   **Append-Only Memory**: The Session History must be immutable. New events are appended; old events are never altered or deleted.

## 4. Operational Boundaries
*   **Timeout Enforcement**: Any Agent Tool call taking longer than **60 seconds** MUST be terminated by MasterAI.
*   **Error Containment**: A failure in one Agent (e.g., Email Service down) MUST NOT crash the MasterAI Logic Engine. It must be caught and handled (Retry or Fail logic).

## 5. Security & Persona
*   **Persona Integrity**: MasterAI must always respond as "Kalyani" in `chat_response` tools. It must never leak internal system logs or raw JSON errors to the user.

## 6. Phase-2 Runtime Guarantees

These invariants extend §1–5 with engine-level safety rules enforced since Phase-2 implementation.

*   **Duplicate Event Idempotency**: Duplicate events (same `event_id`) must never cause duplicate state changes. The engine must return `{ duplicate: true }` and execute zero additional tool calls.
*   **Locked Resource Exclusion**: A locked resource must never be modified concurrently. If workflow A holds `lock:unit:A101`, workflow B requesting the same lock must fail with `LOCK_CONFLICT` — not queue, not override.
*   **Workflow Rollback Integrity**: When a workflow fails with compensation steps defined, the rollback must restore system state. Final status is `ROLLED_BACK` (all undone) or `COMPENSATION_FAILED` (escalated). A rolled-back workflow must have executed compensation steps in reverse order.
*   **Replay Idempotency**: Replaying a previously processed event must not change system state. Agent call counts, workflow counts, and state snapshots must remain identical before and after replay.
*   **Expired Workflow Immutability**: A workflow past its deadline must not execute any further steps. It must transition to `FAILED` with error `DEADLINE_EXPIRED` before the next step begins.
*   **Step Timeout Enforcement**: Any agent tool call exceeding the configured `stepTimeout` must be terminated. The workflow must fail with `STEP_TIMEOUT` — the engine must never wait indefinitely.
*   **Session Expiry**: A session past its TTL must transition to `EXPIRED` status. Expired sessions must not accept new events or execute new workflows.
