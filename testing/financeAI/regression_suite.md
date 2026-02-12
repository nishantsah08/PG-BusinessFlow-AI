# Finance AI Regression Suite 

## 1. Governance Rules
*   **Rule 1: Invariant Locks**: Every invariant defined in `invariants.md` must have a corresponding test case in the regression suite.
*   **Rule 2: Never Delete**: Regression tests for financial correctness must never be deleted. If a business rule changes, the test must be updated to reflect the new truth, and the old version must be archived.
*   **Rule 3: Failure Requirement**: A regression test must fail if the underlying business logic is modified without updating the test.

## 2. Locked Regression Tests
| Test ID | Guard Target | Description |
| :--- | :--- | :--- |
| **REG-FIN-01** | Ledger Equation | Verifies `Balance = Due - Paid` across 100+ random transactions. |
| **REG-FIN-02** | Waterfall Priority | Periodic check to ensure allocation order (Deposit > Arrears > Rent) is intact. |
| **REG-FIN-03** | Contract Adherence | Proves billing uses negotiated rates instead of property-level public rates. |
| **REG-FIN-04** | Immutability Guard | Re-executes "Modify Transaction" scenarios to ensure persistent rejection. |
| **REG-FIN-05** | Sum Conservation | Validates that total transaction amount always equals total allocations. |
| **REG-FIN-06** | Salary Logic | Daily check for salary calculation correctness against sample HR cards. |

## 3. Regression Procedure
1.  Run the full suite before any deployment.
2.  Any failure in Layer 1 or Layer 2 tests blocks the release.
3.  If a business logic change (e.g., Waterfall Priority change) causes a failure:
    *   Update `invariants.md`.
    *   Update the corresponding regression test.
    *   Document the reason for the logic shift in the regression log.
