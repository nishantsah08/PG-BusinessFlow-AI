# CRM Agent Test Plan

## Scope
This plan covers the **Domain Logic** and **Data Integrity** of the CRM Agent.
It excludes:
- HTTP API layer (Express routes) - covered in Layer 4 (Future).
- Frontend UI - covered in Layer 5 (Future).

## Testing Strategy
We follow the **Invariant-Driven Testing** philosophy.
1.  **Validate Invariants**: Ensure no operation violates `invariants.md`.
2.  **Adversarial Edge Cases**: actively try to break the system (Duplicate phones, Invalid transitions).
3.  **Lifecycle Verification**: Prove the State Machine holds.

## Test Layers

| Layer | Type | Focus | Implementation |
|---|---|---|---|
| 1 | **Domain** | Invariants, Logic, Data Model | `identity.test.js`, `lifecycle.test.js`, `append_only.test.js`, `merge_logic.test.js`, `snapshot_process.test.js` |
| 2 | **Integration** | Multi-step flows, Persistence | `artifacts.test.js`, `contract_validation.test.js` |
| 3 | **Contract** | Input/Output shapes | `contract_validation.test.js` |

## Tools & Environment
- **Runner**: Jest
- **Mode**: In-Memory (Phase 1)
- **Time**: Mocked or System Time (IST)

## Critical Paths
1.  **Lead Creation**: Must ensure uniqueness.
2.  **Status Change**: Must validate transition.
3.  **Merge**: Must preserve data and timeline.
4.  **Session Log**: Must be distinct and immutable.
