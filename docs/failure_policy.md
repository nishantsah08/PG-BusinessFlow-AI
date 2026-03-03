# System Failure & Recovery Policy (v1.2)

## 1. Executive Summary
This document defines the standard operating procedures for system failures, ensuring reliability, data integrity, and swift recovery.

**Core Philosophy:**
- **Control Plane**: Fail Fast (Don't hang the user).
- **Data Plane**: Infinite Retry (Don't lose data).
- **Workflows**: Atomic Execution (All or Nothing).
- **Financial Safety**: Manual Human Verification (CEO-in-the-loop).

---

## 2. Failure Protocols

### 2.0 Operational Readiness & Access Gating
*Applies to: API server runtime and deployment health checks*

*   **Readiness Contract**: Service exposes:
    *   `GET /health` for liveness.
    *   `GET /ready` for dependency/config readiness checks.
*   **Production Access Control**:
    *   Google-authenticated access is mandatory for protected APIs in production mode.
    *   Access policy mode is environment-driven:
        *   `GOOGLE_AUTH_MODE=internal` (allow-list/domain restricted).
        *   `GOOGLE_AUTH_MODE=public` (any verified Google identity).
*   **Debug Surface Governance**:
    *   `ALLOW_DEBUG_ENDPOINTS=false` in production disables debug-only endpoints.

### 2.1 Synchronous Control Plane (MasterAI → Agent)
*Applies to: Direct tool calls (e.g., MasterAI calling CRM to `get_lead`)*

*   **Behavior**: **Fail Fast**.
*   **Timeout**: Strict **60 Seconds**.
*   **Retry Policy**: **Zero Automatic Retries**.
    *   *Reasoning*: If a service is overloaded, retrying immediately only adds to the load (Thundering Herd problem).
*   **User Experience**:
    *   If a call fails, MasterAI **must** immediately inform the user: *"System unavailable, please try again."*
    *   MasterAI must **NOT** silently retry or wait.

### 2.2 Asynchronous Data Plane (Agent → MasterAI)
*Applies to: Events published to the Event Bus (e.g., `lead.signup`, `payment.received`)*

*   **Behavior**: **Infinite Retry (via Infrastructure)**.
*   **Mechanism**: Google Cloud Pub/Sub.
*   **Retention**: Messages persist for **7 Days** by default.
*   **Retry Policy**:
    *   **Network/Availability Issues**: **Infinite Retry**. The system will keep trying until MasterAI is back online.
    *   **Application Errors (Crashes/Bugs)**: **Limited Retry (3 Attempts)**.
        *   If a specific event causes MasterAI to *crash* or throw an *unhandled exception* 3 times, it is classified as a "Poison Pill".
*   **Dead Letter Queue (DLQ)**:
    *   **Condition**: After 3 failed attempts due to *application error*.
    *   **Action**: Move event to `system.events.dlq` topic.

---

## 3. Workflow Atomicity & Recovery
*   **Rule**: **Atomic Workflows**.
    *   Workflows must execute fully to be considered successful.
    *   If any step fails, the **entire workflow** MUST be rolled back.
*   **Mechanism**: **Compensation Logic** (Programming Undo steps).
    *   *Example*: Workflow [Assign Tenant -> Record Payment].
    *   If `Record Payment` fails, the system must trigger `Undo Assign Tenant` to rollback the state.
    *   This ensures the system never ends up in a "half-done" state.

---

## 4. Financial Consistency (CEO Verification)
*   **Process**: All incoming payments are verified manually.
*   **Flow**:
    1.  User sends payment screenshot to CEO.
    2.  CEO verifies bank account.
    3.  CEO sends message to MasterAI (WhatsApp): "Received 15000 from Rohit".
    4.  MasterAI triggers `FinanceAgent.record_payment`.
*   **Consistency Guarantee**: Since the CEO is the "Human Oracle" verifying the physical bank state, the system relies on this manual confirmation as the source of truth.

---

## 5. Alerting Channel
*   **Critical Failures**: **WhatsApp/Email to CEO**.
*   **Triggers**: DLQ Events, System Down.
