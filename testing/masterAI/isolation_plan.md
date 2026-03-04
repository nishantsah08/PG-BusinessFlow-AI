# MasterAI Isolation Test Plan

We test MasterAI without spinning up the other Agents. We treat the other Agents as **Mock Objects**.

## 1. The Test Harness
*   **Input**: `FakeEvent` + `FakeContext`
*   **System Under Test**: `MasterAI.LogicEngine`
*   **Output**: `ToolCalls` (Spy on the Mock Agents)

## 2. Fakes & Mocks
### Fake Events
*   `FakeMessageEvent(user_id, text)`
*   `FakePaymentEvent(txn_id, amount, status)`
*   `FakeSystemEvent(type, payload)`

### Fake Contexts
*   `Context.NewUser`: `{ profile: null, history: [] }`
*   `Context.Tenant`: `{ profile: { id: "123", role: "tenant" }, active_workflow: null }`
*   `Context.Admin`: `{ profile: { id: "999", role: "admin" } }`

### Mock Agents (Spies)
*   **CRM Spy**: Records calls to `add_lead`, `update_profile`.
*   **Property Spy**: Returns canned `availability` responses.
*   **Finance Spy**: Returns canned `payment_link` or `ledger_status`.

## 3. Verification Logic
For every test case:
1.  **Setup**: Inject `FakeContext` into `LogicEngine`.
2.  **Trigger**: Push `FakeEvent` to `LogicEngine`.
3.  **Assert**:
    *   Did `LogicEngine` call the expected **Mock Agent Tool**?
    *   Did the **Context** update correctly?
    *   Did the **Workflow State** transition correctly?

## 4. Phase-2 Harness Extensions

The Test Harness has been extended with five new APIs to support resilience validation. These are tested and documented in `philosophy.md §5`.

### `replayEvent(event)`
Re-injects an event with the **same `event_id`** into `LogicEngine.processEvent()`. Does not regenerate a correlation ID. Returns `{ duplicate: true, originalWorkflowId }` if the event was already processed. Used to validate idempotency guarantees.

### `runParallel(configs[])`
Accepts an array of `{ workflowId, context, eventId? }` objects. Starts all workflows **simultaneously** via `Promise.all` — no sequential awaiting. Enables deterministic testing of resource lock conflicts and concurrent state mutations.

### `setSystemTime(timestamp)`
Overrides the harness clock to a fixed timestamp (ms or ISO string). All `LogicEngine` operations that reference time (`_now()`) will use this value. **Time is simulated, not real-time** — no `setTimeout` is used for time-based logic in the engine.

### `advanceTime(ms)`
Moves the harness clock forward by `ms` milliseconds. After advancing, automatically triggers:
*   Scheduled event checks (`checkScheduledEvents()`)
*   Any pending deadline or session expiry evaluations

This is the primary mechanism for testing time-dependent behavior deterministically (per `philosophy.md §2.3: Time is a Variable`).

### `getGlobalState()`
Returns a deep-cloned snapshot of the entire system state:
```
{ workflows, activeWorkflows, agents, events, locks, sessions, processedEventIds, scheduledEvents }
```
Used for `deepEqual` assertions to prove that state after a failure scenario equals state after an ideal scenario.
