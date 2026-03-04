# Communications AI Test Plan

Validate that CommunicationsAI reliably converts external communication into internal events and vice-versa without violating system invariants, contracts, or architecture rules.

## Testing Architecture
*   **Layer 1 → Domain Logic Tests**: Adapter Simulation Tests (Testing adapter capabilities).
*   **Layer 2 → Invariant Tests**: Ensuring core business truths hold.
*   **Layer 3 → Integration Event Tests**: Full pipeline (Mock Provider → Adapter → Event → Router → System).
*   **Layer 4 → Contract Tests**: Schema and API compliance.
*   **Layer 5 → Failure / Chaos Tests**: Simulating provider failures, retries, and errors.
*   **Layer 6 → Staging WhatsApp Tests**: Real WhatsApp integration (Only after local pass).

## Scope Definition
CommunicationsAI is responsible ONLY for:
*   Sending messages
*   Receiving messages
*   Formatting per channel
*   Converting communication ↔ events
*   Retrying delivery
*   Reporting status

It must NEVER:
*   Make decisions
*   Modify business data
*   Bypass MasterAI

## Required Test Modules
This test plan mandates the following modules:
1.  `invariants.md`: Core truths.
2.  `test_matrix.md`: Mapping of invariants to tests.
3.  `regression_suite.md`: Critical tests that must always pass.
4.  `mocks/MockWhatsAppProvider.js`: Mandatory simulation of WhatsApp API.

## Definition of Done
CommunicationsAI is approved only if ALL pass:
*   Invariant tests
*   Integration tests
*   Contract tests
*   Chaos tests
*   Regression suite
*   Staging tests (manual certification required for real sending)
