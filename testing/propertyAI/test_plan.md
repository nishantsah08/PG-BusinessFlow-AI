# PropertyAI Testing Plan

1. Scope
This document defines the complete testing instructions for the PropertyAI module.
This testing plan must strictly follow the global testing philosophy defined in: /docs/testing_strategy.md

PropertyAI is responsible for:
- Property management
- Unit inventory
- Status lifecycle
- Amenities inheritance
- Double booking prevention
- Meter linking
- Deposit calculation logic
- Logical delete enforcement

Testing must focus on business invariants and risk protection.

2. Testing Layers Required
PropertyAI must implement the following test layers:
- Domain Tests (mandatory)
- Integration Tests
- Contract Tests (when interacting with other AI modules)
- Regression Protection Suite
UI tests are not required at this stage.

3. Core Invariants (Must Be Protected)
The following invariants define system truth. AI must generate tests that attempt to break each invariant.

**Booking & Status**
- A unit cannot have two active bookings.
- New booking allowed only if: Unit is empty, OR Current tenant is in Notice status.
- Valid state transitions: Available → Booked, Booked → Notice, Notice → Available.
- All other transitions must fail.

**Logical Delete**
- If a unit/property has historical records → soft delete only.
- If no history → hard delete allowed.
- Soft-deleted entities: Must not appear in active queries. Must remain retrievable internally.

**Amenities**
- Property has base amenities.
- Unit amenities must be a subset of property amenities.
- Unit cannot introduce new amenities not present at property level.
- get_amenities must return property-level amenities only.

**Data Integrity**
- Property name must be unique.
- Unit number must be unique within a property.
- Meter can only link to valid existing units.
- Duplicate meter linking must fail.

**Deposit Logic**
- 1st–5th start date → Standard deposit.
- 6th–10th → Standard + Dynamic.
- Dynamic = (Daily_Rent × 5), rounded to nearest 50.
- Boundary dates must behave deterministically.
- Deposit logic is high-risk and must have boundary tests.

4. Folder Structure for PropertyAI Testing
All testing artifacts must be stored under: /testing/propertyAI/
Structure:
/testing/propertyAI/
    test_plan.md            ← This document
    invariants.md           ← Module-level invariant breakdown
    test_matrix.md          ← Structured scenario table
    regression_suite.md     ← Permanent regression list
    generated_tests/        ← AI-generated executable specs

AI must not modify /docs/testing_strategy.md.

5. AI Test Generation Instructions
When generating tests, AI must:
- Prioritize financial logic first.
- Prioritize double booking prevention.
- Include boundary cases.
- Include invalid transitions.
- Include adversarial scenarios.
- Avoid trivial CRUD-only tests.
- Generate regression guards for each critical invariant.

Tests must follow this format (documentation level):
Test Name:
Category:
Preconditions:
Action:
Expected Result:
Invariant Protected:
Risk Level:

Executable tests must reflect these cases exactly.

6. Domain Test Requirements
Domain tests must cover:
- Deposit calculation
- Status transitions
- Soft delete enforcement
- Amenity subset validation
- Uniqueness constraints
These must be deterministic and isolated.

7. Integration Test Requirements
Integration tests must simulate:
- Property creation
- Unit creation
- Meter linking
- Booking
- Notice transition
- Rebooking
- Deletion attempt
All invariants must remain intact during flow.

8. Regression Suite Rules
Every invariant must have:
- At least one permanent regression test
- A failing scenario case
- A boundary test if financial

When business rules change:
- Update invariants.md
- Update test_matrix.md
- Regenerate tests
- Ensure failure before update passes

9. Versioning & Change Policy
When PropertyAI logic changes:
- Do not modify global strategy.
- Update module invariants.
- Update test matrix.
- Regenerate or update tests.
- Re-run regression suite.
Testing artifacts must evolve independently of /docs.

10. AI Execution Order
When AI is asked to generate PropertyAI tests:
It must:
- Read /docs/testing_strategy.md
- Read /testing/propertyAI/test_plan.md
- Generate or update: invariants.md, test_matrix.md, Regression tests
- Store executable tests inside /testing/propertyAI/generated_tests/

11. Success Criteria
Testing is considered sufficient when:
- All invariants are covered.
- Boundary cases are covered.
- Invalid transitions fail.
- Financial logic is regression-locked.
- Double booking cannot occur under any scenario.
- Soft delete cannot leak into active queries.
