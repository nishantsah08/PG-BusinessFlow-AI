# Contract Simulation Plan

This document defines how we simulate Agent behaviors to test MasterAI's response handling.

## 1. Simulation Modes
We need a `MockAgent` class that can be configured to behave in these modes:

| Mode | Behavior | MasterAI Expected Reaction |
| :--- | :--- | :--- |
| `SUCCESS` | Returns valid JSON payload immediately. | Proceed to next step. |
| `TIMEOUT` | Hangs for >60s. | Terminate call, Retry/Fail. |
| `INVALID_PAYLOAD` | Returns malformed JSON or HTTP 500. | Handle gracefully, Log Error. |
| `SLOW_RESPONSE` | Returns valid JSON after 45s. | Should succeed (latency > threshold?). |
| `EXCEPTION` | Throws unhandled JS error. | Catch error, Fail Step safely. |
| `DUPLICATE_EVENT` | Same `event_id` submitted twice. | Second call returns `{ duplicate: true }`, no state change. |
| `REPLAY_EVENT` | Previously processed event replayed. | Engine rejects silently, agent call count unchanged. |
| `LOCK_CONFLICT` | Step requires lock held by another workflow. | Workflow fails with `LOCK_CONFLICT`, no step execution. |
| `DEADLINE_EXPIRED` | Workflow clock past deadline. | Workflow fails with `DEADLINE_EXPIRED`, no further steps. |

### Phase-2 Mode Details

*   **`DUPLICATE_EVENT`**: Simulated via `processEvent()` with a previously used `event_id`. The engine's `processedEventIds` map detects the duplicate and returns immediately. No workflow is created, no agents are called. Test assertion: `getGlobalState()` unchanged.
*   **`REPLAY_EVENT`**: Simulated via `harness.replayEvent()` with a completed event. Identical to `DUPLICATE_EVENT` at the engine level, but semantically distinct — replays test the system's resistance to event stream re-processing (e.g., log replay during recovery).
*   **`LOCK_CONFLICT`**: Simulated via `harness.runParallel()` with two workflows declaring `locks: ['same_resource']`. The first workflow acquires the lock; the second receives `LOCK_CONFLICT` and fails without executing the step. Lock is released when the winning workflow completes.
*   **`DEADLINE_EXPIRED`**: Simulated via `harness.setSystemTime()` + `harness.advanceTime()` to move the clock past the workflow's deadline. The engine checks the deadline before each step iteration and fails immediately.

## 2. Mock Configuration
The `MockAgent` should accept a `config` object per test:
```javascript
const mockCRM = new MockAgent({
    add_lead: { mode: 'SUCCESS', delay: 100 },
    update_profile: { mode: 'TIMEOUT' } 
});
```

## 3. Dynamic Injection
Tests must inject these configured mocks into the `LogicEngine` at runtime.
