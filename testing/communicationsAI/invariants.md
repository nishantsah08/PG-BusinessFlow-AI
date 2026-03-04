# Communications AI Invariants

This document defines the core truths that must NEVER be violated by the Communications AI module.

## 1. Event Invariants
*   **IE1**: Every valid inbound message must produce **exactly one** system event.
*   **IE2**: Every event must have a unique, non-null `event_id`.
*   **IE3**: Every event must have a valid ISO-8601 `timestamp`.
*   **IE4**: The payload must strictly match the schema for the specific channel.
*   **IE5**: Events from external sources must pass signature validation.

## 2. Delivery Invariants
*   **ID1**: Every outbound attempt must emit a `status` event (sent/failed).
*   **ID2**: A delivery failure must trigger the retry mechanism (unless fatal).
*   **ID3**: Exhausted retries must result in a Dead Letter Queue (DLQ) entry.
*   **ID4**: No message is marked 'delievered' without a confirmation from the provider.

## 3. Security Invariants
*   **IS1**: Unsigned or invalidly signed webhooks must be rejected immediately (401/403).
*   **IS2**: Webhooks with expired timestamps (TTL) must be rejected.
*   **IS3**: Replayed webhooks (same ID) must be rejected or handled idempotently.

## 4. Processing Invariants
*   **IP1**: Duplicate webhooks from the provider must NOT result in duplicate system events.
*   **IP2**: The system must process a specific `event_id` only once.

## 5. Channel Invariants
*   **IC1**: Outbound content must be compatible with the target channel capabilities.
## 6. System Reliability Invariants
*   **IR1**: Correlation Chain (`correlation_id`, `conversation_id`) must persist across message flows.
*   **IR2**: Routing Metadata (`priority`, `ttl`) must be enforced according to event type.
*   **IR3**: Observability Logs (`received_at`, `processed_at`, `latency`) must be present in every event.
