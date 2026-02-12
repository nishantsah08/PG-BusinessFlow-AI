# Testing Strategy

## 1. Purpose

This document defines the universal testing philosophy and governance model for the entire application ecosystem.

It applies to:

- All backend modules (Property AI, Finance AI, etc.)
- All future AI agents
- All integration layers
- All future frontend systems

> [!NOTE]
> This document does not contain module-specific test cases.
> Operational test artifacts are stored separately in the `/testing` directory.

---

## 2. Core Philosophy

Testing exists to protect:

- Business invariants
- Financial correctness
- State machine integrity
- Data integrity
- Inter-agent contracts
- Regression stability

**Testing is not performed for code coverage vanity.**
**Testing is performed for system risk control.**

---

## 3. Layered Testing Model

All modules must follow the same layered structure.

### Layer 1 — Domain Tests (Mandatory)

Tests pure business logic.

- Deterministic
- Minimal external dependency
- Focus on invariants
- Must exist for every AI module

> These are **permanent** and **highest priority**.

### Layer 2 — Integration Tests

Validate multi-step workflows.

Examples:

- Entity lifecycle
- State transitions
- Multi-operation scenarios

> These protect real-world usage flows.

### Layer 3 — Contract Tests

Required when one AI/module communicates with another.

These validate:

- Payload structure
- Required fields
- Financial value consistency
- Version compatibility

> [!IMPORTANT]
> No inter-agent communication should occur without contract tests.

### Layer 4 — API Tests

Validate interface boundaries:

- Input validation
- Error handling
- Authentication
- Response shape

> These protect system edges.

### Layer 5 — UI Tests (Future)

Validate:

- User flows
- UI state changes
- Error display
- Interaction correctness

> UI tests are only required once frontend is introduced.

---

## 4. Invariant-Driven Testing

Every module must define its own invariants.

An invariant is:

- A condition that must **always** hold true.
- A rule that must **never** be violated.
- A business truth independent of implementation.

> [!IMPORTANT]
> All test generation must be based on invariants first, not implementation details.

---

## 5. State Machine Enforcement

Any entity with a status must define:

- Allowed transitions
- Forbidden transitions

Tests must validate:

- All valid transitions succeed.
- All invalid transitions fail.

> [!CAUTION]
> Silent state corruption is unacceptable.

---

## 6. Financial Logic Priority

Any logic involving:

- Money
- Deposits
- Rent
- Fees
- Penalties
- Calculations

Must receive:

- Boundary tests
- Edge case tests
- High-value stress tests
- Regression locks

> [!WARNING]
> Financial logic is considered **high risk**.

---

## 7. Soft Delete Governance

If soft delete exists, tests must ensure:

- Soft-deleted entities are **not** visible in active queries.
- Historical data remains intact.
- Business operations cannot operate on disabled entities unless explicitly allowed.

---

## 8. Regression Discipline

Every critical invariant must have permanent regression coverage.

When business rules change:

1. Update module invariant document.
2. Update module test plan.
3. Regenerate or modify tests.
4. Ensure failing tests reflect rule change.

> **Tests must fail when logic is broken.**

---

## 9. Test Isolation

All tests must:

- Be independent
- Not rely on execution order
- Not depend on external persistent state unless explicitly integration-level
- Produce deterministic results

---

## 10. Testing Artifact Structure

Testing artifacts are **not** stored inside `/docs`.

All operational testing materials must live in:

```
/testing/
```

Each module must maintain its own folder:

```
/testing/propertyAI/
/testing/financeAI/
/testing/shared/
```

Each module folder should contain:

- `test_plan.md`
- `test_matrix.md`
- `regression_suite.md`
- Generated test specifications
- Version history if applicable

> The `/docs` folder contains **strategy only**.

---

## 11. AI Test Generation Rules

When AI is used to generate tests, it must:

- Prioritize invariants over CRUD.
- Focus on risk-heavy logic first.
- Include boundary cases.
- Include invalid scenarios.
- Include adversarial scenarios.
- Generate regression guards for critical rules.

> [!CAUTION]
> AI must not generate trivial status-code-only tests unless explicitly requested.

---

## 12. Evolution Policy

This strategy document should remain stable.

- Module-specific invariants and test plans evolve independently inside `/testing`.
- If testing philosophy changes system-wide, this document may be updated.
- Otherwise, this document serves as the **permanent governance reference**.

---

*End of Document*