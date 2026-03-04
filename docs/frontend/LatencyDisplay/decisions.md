# LatencyDisplay Design Decisions

## 1. Top-Down State Orchestration
- **Why built this way:** Request logs are intrinsically workflow and system observation state. Adheres to "Forbidden global state". Passing props from the orchestrator guarantees no forbidden global states.
- **Alternatives considered:** Event bus listener / Publish-Subscribe model where `apiClient` emits events directly to `LatencyDisplay`.
- **Why rejected:** Harder to trace data flow logically in React, prone to memory leaks if components unmount.
- **Assumptions made:** `ControlPanel` will truncate the maximum array size passing down `logs` to prevent rendering thousands of unpaginated items.

## 2. Inferred Top-level Status
- **Why built this way:** Bypasses `loading` because data is passed synchronously; infers `success` from array length. Fits the mandatory 5-state requirement conceptually even without internal fetching.
- **Alternatives considered:** Writing dummy async logic just to physically trigger a `loading` state spinner on mount.
- **Why rejected:** Wastes CPU cycles and offers poor UX.
- **Assumptions made:** The `empty` state ("No API requests have been made yet") is the mathematically logical default state before the user acts.
