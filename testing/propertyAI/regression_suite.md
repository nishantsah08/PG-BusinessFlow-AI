# PropertyAI Regression Suite

## Permanent Regression Guards

These tests must **always pass**. Failure indicates a regression in core business logic.

- [ ] `deposit.test.js`: Boundary check for 5th vs 6th of month.
- [ ] `status_transitions.test.js`: Invalid transition guards (Booked -> Available).
- [ ] `uniqueness.test.js`: Property name uniqueness.
- [ ] `amenities.test.js`: Unit cannot add non-existent amenity.
- [ ] `disable_state.test.js`: Disabled entities reject active operations; enable/disable tools work.
- [ ] `soft_delete.test.js`: History preservation check.

## Last Run Status
- Status: Passed
- Date: 2026-03-10
