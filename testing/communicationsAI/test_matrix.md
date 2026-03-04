# Communications AI Test Matrix

This matrix maps core invariants to specific test cases.

| Invariant ID | Test Case ID | Description | Layer |
| :--- | :--- | :--- | :--- |
| **IE1** | TC01 | Incoming webhook → Event Created | Integration |
| **IE2** | TC02 | Event ID Uniqueness Check | Domain |
| **IE3** | TC03 | Timestamp Validation Test | Domain |
| **IE4** | TC04 | Payload Schema Compliance | Contract |
| **IE5** | TC05 | Invalid Signature Rejection | Security |
| **ID1** | TC06 | Outbound Message → Status Event | Integration |
| **ID2** | TC07 | Delivery Failure → Retry Logic | Failure |
| **ID3** | TC08 | Max Retries → DLQ Event | Failure |
| **IS1** | TC09 | Unsigned Request → 401 | Security |
| **IS2** | TC10 | Expired Timestamp → 400 | Security |
| **IP1** | TC11 | Duplicate Webhook Idempotency | Processing |
| **IP2** | TC12 | Duplicate Event ID Rejection | Processing |
| **IC1** | TC13 | Unsupported Media Type → Error | Channel |
| **IC2** | TC14 | Invalid Phone Number Handling | API Boundary |
| **IR1** | TC15 | Correlation Chain Persistence | System |
| **IR2** | TC16 | Routing Priority Enforcement | System |
| **IR3** | TC17 | Observability Metadata Check | System |
