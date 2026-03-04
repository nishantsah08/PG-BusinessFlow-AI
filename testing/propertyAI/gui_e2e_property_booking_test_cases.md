# Property & Booking GUI E2E Test Cases

## Purpose
Define executable UI cases for `/property` that align with the system testing philosophy in `docs/testing_strategy.md`, especially Layer 5 (UI Tests) while preserving business-risk signals from PropertyAI invariants.

## Philosophy Fit Check
- Global strategy already fits this surface because Layer 5 requires validation of user flows, UI state changes, error display, and interaction correctness.
- Property/Booking GUI must also reflect domain safeguards (invariants) where observable in UI workflows.
- No strategy rewrite is required; only consistent traceability from GUI cases to risk controls.

## Test Cases

| ID | Category | Scenario | Expected Result | Invariant/Risk Link | Priority |
|---|---|---|---|---|---|
| PB-GUI-001 | UI Flow | Open `/property` and verify all 4 sections are present | All tab controls render and section switching works | Navigation integrity / operational continuity | High |
| PB-GUI-002 | Integration UI | Property Management add unit flow | Newly added unit appears in Registered Units list | Data integrity + inventory lifecycle | High |
| PB-GUI-003 | Edge UI | Booking Overview with zero units for selected property | Explicit "No Physical Layout Created" state appears | Empty-state correctness; avoids misleading occupancy interpretation | High |
| PB-GUI-004 | Integration UI | Electric Meters add meter then add reading | Meter appears and new reading is visible in history | Meter operation reliability | High |
| PB-GUI-005 | Integration UI | Maintenance log ticket then progress status | Ticket is created and status transitions to IN_PROGRESS in UI | Maintenance state progression | High |
| PB-GUI-006 | Edge UI | Empty dataset across all sections | Stable empty states shown; no crashes | Resilience against no-data startup | High |
| PB-GUI-007 | Failure UI | Backend failures on master tool endpoints | Route remains usable, no fatal UI crash | Failure containment / retry readiness | High |

## Execution Notes
- E2E automation file: `client/e2e/property-booking.spec.js`
- Execution command: `npm run test:e2e -- property-booking.spec.js` (run from `client/`)
- Default isolated e2e port: `4273` (configured in `client/playwright.config.js`)
