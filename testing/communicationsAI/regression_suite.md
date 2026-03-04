# Communications AI Regression Suite

These tests must pass on every commit. Failure blocks deployment.

## Mandatory Tests

1.  **IE1: Inbound Webhook Processing**
    *   Simulate a valid inbound text message webhook.
    *   Validate that a corresponding `message.received` event is emitted.
    *   Validate event payload has correct `from`, `body`, and `timestamp`.

2.  **ID1: Outbound Message Status**
    *   Send a text message via `WhatsAppAdapter`.
    *   Simulate successful delivery from mock provider.
    *   Validate that a `message.status` event (`sent`/`delivered`) is emitted.

3.  **IS1: Signature Validation**
    *   Simulate a webhook with an invalid `X-Hub-Signature`.
    *   Expect HTTP 401/403 response.
    *   Ensure NO event is processed.

4.  **IP1: Idempotency Check**
    *   Send the *same* webhook payload twice (same ID).
    *   Validate that only **one** event is emitted to the system.
    *   Validate second response is 200 OK (idempotent success).

5.  **ID2: Retry Logic**
    *   Simulate a temporary failure (500) from the mock provider on send.
    *   Validate that the adapter retries the request.
    *   Simulate success on retry.
    *   Validate final status is `sent`.

6.  **IC1: Unsupported Media Handling**
    *   Attempt to send an unsupported file type (e.g., `.exe`).
    *   Expect immediate error from adapter validation.

7.  **IR1: Correlation Persistence**
    *   Simulate an inbound message with specific `thread_id` (context).
    *   Validate that the emitted event contains a valid `correlation.conversation_id`.
    *   Simulate an outbound message with a `correlation_id` in input.
    *   Validate that any status events linked to it preserve that `correlation_id`.

8.  **IR2: Routing Metadata**
    *   Validate that `message.received` events have `routing.priority: 'critical'`.
    *   Validate `routing.ttl_ms` is set (e.g., 5000ms).

9.  **IR3: Observability**
    *   Validate `received_at` matches webhook timestamp.
    *   Validate `processed_at` is generated.
    *   Validate `latency` is calculated (`processed_at - received_at`).
