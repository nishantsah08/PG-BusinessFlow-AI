# Finance AI Domain Invariants 

These invariants define the business truths that Finance AI must enforce at all times. Any violation of these invariants represents a critical system failure.

## 1. Ledger Invariants
*   **LED-01: Append-Only**: The ledger is an immutable history of events. Existing entries must never be overwritten or deleted.
*   **LED-02: Equation Correctness**: For any ledger bucket, `Balance = Amount Due - Amount Paid`.
*   **LED-03: Status Integrity**: The `status` field (PAID, PARTIALLY_PAID, PENDING) must always be a direct derived property of the `balance`.
*   **LED-04: Non-Negative Balances**: No ledger entry should ever have a negative balance; overpayments are handled via separate credit buckets.
*   **LED-05: Payer Identity**: Every ledger entry must be linked to a valid `payer_id` (Lead/Tenant).

## 2. Transaction Invariants
*   **TXN-01: Automatic Allocation**: All incoming payments MUST trigger the waterfall allocation logic immediately upon recording.
*   **TXN-02: Priority Adherence**: Allocations must strictly follow the defined waterfall priority (Deposit > Past Dues > Fees > Rent, etc.).
*   **TXN-03: Sum Conservation**: The sum of all `allocations` for a transaction must exactly equal the `amount` of the transaction.
*   **TXN-04: Immutability**: Once a transaction is recorded and allocated, it becomes immutable.
*   **TXN-05: Unique Txn ID**: Every transaction must have a globally unique `txn_id`.

## 3. Contract Invariants
*   **CON-01: Negotiated Rate Enforcement**: Billing generation MUST use the **Negotiated Rate Card** stored in Finance AI, not the public rate card from Property AI.
*   **CON-02: Payment Timing Compliance**: Rent timing (ADVANCE/ARREARS) and Utility timing must respect the terms defined in the tenant's negotiated contract.
*   **CON-03: Meter Delta Consistency**: Electricity charges must be calculated as `(Current Reading - Last Reading) * Rate`.

## 4. Financial Safety Invariants
*   **SAF-01: Surety Requirement**: No transaction record or ledger update is permitted unless the system state is "SURE".
*   **SAF-02: Uncertainty Rejection**: If the system detects an inconsistent or uncertain account state, it must reject the operation and require manual reconciliation.
*   **SAF-03: Delegated Execution**: Finance AI itself must never execute external actions; it must only direct its sub-agents (Billing, Accounting, Salary).
