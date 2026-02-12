# Finance AI Test Matrix (Domain Logic)

This matrix maps core functional tools to risk categories and specific test scenarios.

| Tool | Risk | Test Type | Scenario | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| `record_incoming_txn` | **Critical** | Invariant | Automatic Allocation | Transaction total sum = sum of all bucket allocations. |
| `record_incoming_txn` | **Critical** | Integration | Waterfall Priority | Funds fill Deposit → Arrears → Rent in exact sequence. |
| `record_incoming_txn` | High | API | Malformed Attachments | Reject if artifact link is not a valid GCS URI. |
| `record_incoming_txn` | Medium | Edge Case | Zero Amount | Reject or log as informational info; no ledger impact. |
| `record_incoming_txn` | High | Adversarial | Duplicate TXN ID | Reject re-submission of the same `txn_id`. |
| `add_ledger_entry` | High | Invariant | Append Only | New entry creation must not modify or hide existing entries. |
| `add_ledger_entry` | High | Invariant | Non-Negative | Entry rejected if `amount_due` is negative. |
| `add_ledger_entry` | Medium | Integration | Status Sync | Balance 0 → Status PAID; Balance > 0 → Status PENDING/PARTIAL. |
| `generate_monthly_bills` | High | Invariant | Negotiated Contract | Ignores Property AI rates; uses Finance AI negotiated terms. |
| `generate_monthly_bills` | Medium | Integration | Timing Rules | Advance rent generated for Next Month; Arrears utility for Last Month. |
| `generate_monthly_bills` | High | Edge Case | Pro-rata Calculation | Correct calculation for mid-month onboarded tenants. |
| `process_salary_payout` | High | Integration | Salary Card Sync | Calculation matches `HR.base_salary + incentives - advances`. |
| `process_salary_payout` | Medium | API | Invalid Staff ID | Reject with clear error if `staff_id` not found in HR. |
| `get_ledger` | Low | API | Missing Payer ID | Strict rejection of query without `payer_id`. |

## Adversarial & Safety Matrix
| Action | Threat | Mitigation Case | Expected Result |
| :--- | :--- | :--- | :--- |
| `record_incoming_txn` | Replay Attack | Record the same payment twice | System rejects with "Duplicate Transaction ID". |
| `record_incoming_txn` | Forged Allocations | Pushing manual allocations in payload | System ignores manual inputs; recalculates via Waterfall. |
| `update_transaction` | State Corruption | Attempting to modify a post-allocation txn | Tool doesn't exist (Immutability). |
| `manual_overwrite` | Ledger Tampering | Direct balance modification | Blocked by state machine; correction only via new entries. |
