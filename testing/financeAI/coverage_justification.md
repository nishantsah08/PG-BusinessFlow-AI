# Coverage Justification & Risk Map

This document justifies the testing depth and maps system risks to the test infrastructure provided.

## 1. Risk Coverage Map
| System Risk | Impact | Mitigation Strategy | Test Coverage |
| :--- | :--- | :--- | :--- |
| **Silent Ledger Corruption** | Critical | Append-only guards + Sequence ID checks | `ledger_integrity.test.js` (LED-01) |
| **Financial Allocation Fraud** | Critical | Waterfall Priority enforcement | `waterfall_allocation.test.js` (TXN-02) |
| **Revenue Leakage** | High | Negotiated rate card enforcement | `contract_enforcement.test.js` (CON-01) |
| **Double Payout / Replay** | High | Uniqueness checks on Txn IDs | `api_boundary.test.js` (Duplicate ID) |
| **State Machine Desync** | High | Status-to-Balance derivation rules | `ledger_integrity.test.js` (LED-03) |
| **Unauthorized Overwrites** | Critical | In-memory/Storage immutability locks | `waterfall_allocation.test.js` (TXN-04) |

## 2. Coverage Justification

### Why this depth?
Financial systems are "High Risk" by definition. Simple status-code tests are insufficient. The provided infrastructure focuses on **Invariants** because code behavior may change, but business truths (like "Rent is paid after Deposit") must never shift without explicit policy changes.

### Layer 1 (Domain) Coverage
100% of defined P1 risks (Ledger and Waterfall) are covered by deterministic tests. These tests are locked in the regression suite to prevent future developer errors from polluting the financial state.

### Layer 2 (Integration) Coverage
Scenario-based tests (Partial, Overpayment, Arrears) cover the most common "edge" paths in property management. This ensures that even if individual components work, the multi-month "Money Story" of a tenant remains accurate.

### Layer 3 & 4 (Safety) Coverage
Strict API boundaries and adversarial tests (manual allocation override attempts) ensure that even malformed or malicious inputs cannot bypass the CFO's core logic.

## 3. Residual Risk & Recommendations
*   **Concurrency**: While simulated, true multi-threaded payment processing (two UPIs reaching the server at the exact same millisecond) should be tested at the infrastructure level (e.g., DB row locking).
*   **Third-party API Reliability**: Payments depend on Communications AI / Meta. Contract tests are included, but live monitoring is recommended.

---
**Acceptance Status**: DESIGN COMPLETE.
**Security Rating**: COMPLIANT.
