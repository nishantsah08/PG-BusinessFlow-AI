# HR Agent Test Matrix

| Feature | Risk | Test Type | Priority | Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| **Lifecycle: Hiring** | HIGH | Domain | P0 | - Unique Contact<br>- Valid Initial State (Active)<br>- ID Generation Format |
| **Lifecycle: Hiring** | LOW | API | P2 | - Missing Name/Designation<br>- Invalid Phone Format |
| **Lifecycle: Termination** | HIGH | Domain | P0 | - Active -> Terminated Transition<br>- Sets Last Working Day<br>- Cannot Terminate already Terminated |
| **Lifecycle: Termination** | MEDIUM | Integration | P1 | - Terminated staff cannot be granted Leave<br>- Terminated staff cannot be featured in Active queries |
| **Compensation: Create Card** | HIGH | Domain | P0 | - Base Salary >= 0<br>- Bank Details Complete<br>- Incentive Logic Valid |
| **Compensation: Create Card** | HIGH | Contract | P0 | - Schema matches Finance expectation |
| **Compensation: Update Card** | HIGH | Domain | P0 | - History Preserved<br>- Components Updated Correctly |
| **Compensation: Incentives** | HIGH | Domain | P0 | - Calculation Formula Correctness<br>- Zero/Negative Metric Handling |
| **Leaves: Record** | MEDIUM | Domain | P1 | - Start Date <= End Date<br>- No Overlap with existing leaves<br>- Valid Leave Type |
| **Leaves: Record** | LOW | API | P2 | - Invalid Date Format<br>- Non-existent Staff ID |
| **Leaves: Approval** | MEDIUM | Domain | P1 | - Status Transition (Pending -> Approved/Rejected)<br>- Approver Note Persistence |
| **Retrieval: Staff/Cards** | LOW | API | P2 | - Get by ID<br>- Filter by Status<br>- Handle Not Found |
