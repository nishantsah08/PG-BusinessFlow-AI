# Finance AI Test Plan 

## 1. Mission Statement
Proving the absolute integrity of the financial ledger and the enforcement of business truths. Finance AI must ensure that no monetary state can become inconsistent under any condition.

## 2. Test Priorities (Hierarchy of Risk)
| Priority | Area | Objective |
| :--- | :--- | :--- |
| **P1** | **Ledger Correctness** | Verify append-only logic, balance calculations, and status derivation. |
| **P2** | **Payment Waterfall** | Ensure incoming cash is allocated in the exact priority order defined by policy. |
| **P3** | **Transaction Recording** | Validate integrity, immutability, and uniqueness of financial entries. |
| **P4** | **Billing Generation** | Confirm revenue is calculated correctly based on negotiated contracts. |
| **P5** | **Salary Processing** | Validate payroll calculations based on HR salary cards. |
| **P6** | **Reporting Endpoints** | Ensure business analytics reflect the true state of the ledger. |

## 3. Testing Layers
### Layer 1: Domain Tests (Invariants)
Deterministic tests focusing on business logic without external dependencies.
*   **Target**: `record_incoming_txn`, `add_ledger_entry`, `generate_monthly_bills`.
*   **Focus**: Invariant enforcement (Append-only, Waterfall priority, Sum conservation).

### Layer 2: Integration Scenarios
Multi-step workflows simulating real-world financial events.
*   **Scenario A**: Partial payments and arrears handling.
*   **Scenario B**: Overpayments and credit bucket management.
*   **Scenario C**: Multi-month debt accumulation and clearing.

### Layer 3: Contract Tests
Validating the handshake between Finance AI and other modules.
*   **HR → Finance**: Salary card schema and incentive logic.
*   **Property → Finance**: Meter delta accuracy and rate inheritance.
*   **MasterAI → Finance**: Event payload validity.

### Layer 4: API Boundary Tests
Protecting the system edges through strict input validation.
*   **Validations**: Missing fields, malformed dates, negative amounts, duplicate IDs.

## 4. Acceptance Criteria
*   [ ] 100% of defined invariants (d:\3\testing\financeAI\invariants.md) are covered.
*   [ ] All forbidden state transitions and invalid inputs result in strict rejection.
*   [ ] Ledger state remains consistent across all integration scenarios.
*   [ ] Regression suite is locked and provides coverage for all P1/P2 risks.
