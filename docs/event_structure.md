# System Event Architecture Specification

**Document Version:** v1.0  
**Status:** Canonical Standard  
**Scope:** System-wide  
**Applies To:** All agents, adapters, services, schedulers, and integrations  
**Authority:** MasterAI Architecture Layer  
**Time Standard:** IST System Time

---

## 1. Purpose

This document defines the global event communication standard used across the entire platform. 

- All inter-component communication must use this format.
- No component is allowed to communicate outside this specification.

## 2. Design Principles

The event system is designed to guarantee:
- Determinism
- Traceability
- Replayability
- Auditability
- Security
- Observability
- Fault tolerance
- Horizontal scalability

## 3. Architecture Rule (Hybrid Model - ADR-001)

All system communication must follow the **Hybrid Protocol**:

1.  **Control Plane (MasterAI -> Agent)**:
    *   **Method**: Synchronous MCP Calls.
    *   **Authority**: MasterAI acts as the "User" of the tool.
    *   **Transport**: Direct Container-to-Container (over secure internal network).

2.  **Data Plane (Agent -> MasterAI)**:
    *   **Method**: Asynchronous Events via **Routing Engine** (Pub/Sub).
    *   **Flow**: **Component** → **Event** → **Routing Engine** → **MasterAI**.

> [!IMPORTANT]
> Agents must NEVER call each other directly. All Agent-to-Agent flow is orchestrated by MasterAI.

## 4. Terminology

| Term | Meaning |
| :--- | :--- |
| **Event** | Structured message |
| **Source** | Event sender |
| **Target** | Event receiver |
| **Correlation** | Workflow chain identifier |
| **Payload** | Business data |
| **Envelope** | Routing + metadata |

## 5. Event Model Structure

Every event consists of three layers:
1. **Envelope**
2. **Payload**
3. **Control**

## 6. Canonical Event Schema (Mandatory)

```json
{
  "event_id": "UUIDv7",
  "event_type": "string",
  "event_version": "v1",
  "timestamp": "ISO-8601",

  "source": {
    "type": "agent|adapter|system|external",
    "name": "string",
    "instance_id": "string"
  },

  "target": {
    "type": "agent|adapter|broadcast",
    "name": "string"
  },

  "routing": {
    "priority": "low|normal|high|critical",
    "mode": "sync|async",
    "ttl_ms": 60000,
    "retry_policy": "none|simple|exponential|dlq",
    "deadline": "ISO-8601"
  },

  "correlation": {
    "correlation_id": "UUID",
    "causation_id": "UUID",
    "session_id": "string",
    "conversation_id": "string"
  },

  "auth": {
    "actor_id": "string",
    "actor_type": "user|agent|system",
    "roles": []
  },

  "context": {
    "user_id": "string",
    "channel": "voice|whatsapp|email|system",
    "locale": "en-IN",
    "timezone": "IST"
  },

  "payload": {},

  "control": {
    "expect_response": true,
    "response_timeout_ms": 2000,
    "stream": false,
    "partial_allowed": false
  },

  "observability": {
    "trace_id": "string",
    "span_id": "string",
    "parent_span_id": "string"
  },

  "integrity": {
    "checksum": "hash",
    "signature": "optional_internal_mandatory_external"
  }
}
```

## 7. Field Definitions

### 7.1 Identity Fields
| Field | Purpose |
| :--- | :--- |
| **event_id** | Globally unique identifier |
| **event_type** | Classification |
| **event_version** | Schema version |
| **timestamp** | Creation time |

### 7.2 Source Object
Defines origin. Required for:
- Security validation
- Audit logging
- Routing

### 7.3 Target Object
Defines intended recipient. Possible values:
- Specific agent
- Adapter
- Broadcast

### 7.4 Routing Block
Controls delivery logic.

| Field | Purpose |
| :--- | :--- |
| **priority** | Queue order |
| **mode** | Blocking behavior |
| **ttl_ms** | Expiry |
| **retry_policy** | Failure handling |
| **deadline** | Hard stop time |

### 7.5 Correlation Block
Tracks event lineage. Required for:
- Debugging
- Replay
- Analytics
- Audit

### 7.6 Auth Block
Specifies authority context. Used for:
- Permission checks
- Compliance logging
- Security enforcement

### 7.7 Context Block
Environment metadata used for:
- Localization
- Channel logic
- Personalization

### 7.8 Payload Block
Contains event-specific data.
- Payload schema depends on `event_type`.
- Payload must always be structured.
- Raw text is forbidden unless explicitly required.

### 7.9 Control Block
Defines runtime expectations.

### 7.10 Observability Block
Required for distributed tracing systems. Compatible with:
- OpenTelemetry
- Jaeger
- Zipkin

### 7.11 Integrity Block
Ensures message validity. Used for:
- Tamper detection
- Signature validation
- Data integrity

## 8. Event Priority Levels
| Level | Meaning |
| :--- | :--- |
| **critical** | Real-time interaction |
| **high** | User waiting |
| **normal** | Standard |
| **low** | Background |

## 9. Delivery Modes
| Mode | Behavior |
| :--- | :--- |
| **sync** | Sender waits |
| **async** | Fire-and-forget |

## 10. Retry Policies
| Policy | Behavior |
| :--- | :--- |
| **none** | No retry |
| **simple** | Fixed retries |
| **exponential** | Backoff |
| **dlq** | Send to Dead Letter Queue |

## 11. Streaming Events
If `stream = true`:
- Receiver must expect multiple payload fragments.
- Used for: Transcripts, Live analytics, Progress updates.

## 12. Event Lifecycle
1. Created
2. Validated
3. Authorized
4. Routed
5. Processed
6. Acknowledged
7. Logged
8. Archived

## 13. Validation Rules
Event must be rejected if:
- `event_id` missing
- `timestamp` invalid
- `ttl` expired
- `signature` invalid
- `schema` mismatch

## 14. Security Rules
All events must:
- Include auth block
- Pass permission validation
- Be signed if external

## 15. Logging Requirements
Each event must log:
- `received_at`
- `processed_at`
- `latency`
- `processor`
- `result`

> [!NOTE]
> Logs must be append-only.

## 16. Standard System Event Types

### Communication
- `message.received`
- `message.sent`
- `call.started`
- `call.ended`
- `transcript.partial`
- `transcript.final`

### Context
- `context.request`
- `context.response`
- `context.timeout`

### Decision
- `decision.requested`
- `decision.generated`
- `decision.failed`
- `decision.escalated`

### System
- `agent.started`
- `agent.failed`
- `agent.heartbeat`
- `policy.updated`

## 17. Performance Requirements
## 17. Performance Requirements (Removed per ADR-001)
*   System targets realistic Cloud Run SLAs (Cold Starts & Network Latency accepted).
*   **Timeout**: 60 Seconds System-Wide.

## 18. Versioning Rules
- Versions must never be modified
- Only incremented
- Backward compatible

## 19. Failure Handling Protocol
If delivery fails:
**retry** → **fallback** → **dead letter queue** → **alert**

> [!WARNING]
> Events must never be dropped silently.

## 20. Dead Letter Queue Definition
A dead letter queue stores events that could not be processed after retries.

**Purpose:**
- Preserve data
- Allow debugging
- Prevent loss

## 21. Compliance Requirement
- All events must be auditable.
- System must be able to reconstruct any workflow using event logs alone.

## 22. Architectural Law
No component may communicate outside the event system. Violation = architecture breach.

## 23. Minimal Example Event
```json
{
  "event_id": "evt_7812",
  "event_type": "call.started",
  "timestamp": "2026-02-13T10:02:11Z",
  "source": { "type": "adapter", "name": "VoiceAdapter" },
  "target": { "type": "agent", "name": "MasterAI" },
  "routing": { "priority": "critical", "mode": "async" },
  "correlation": { "correlation_id": "conv_991" },
  "payload": { "phone": "+919900000000" }
}
```

## 24. Canonical Definition
A system event is a structured, authenticated, traceable message representing a state change or intent that flows through the platform’s communication infrastructure.

## 25. Final Architectural Insight
In distributed AI systems, event design determines system reliability more than model quality.

## 26. Routing Engine Definition
The **Routing Engine** is the internal message broker responsible for receiving, validating, routing, and delivering all system events.
*   **Phase 1 (Local)**: Implemented as an in-process `EventEmitter` or lightweight message bus.
*   **Phase 2 (Cloud)**: Replaced by **Google Cloud Pub/Sub**.
*   **Rule**: No agent or adapter communicates directly — all traffic flows through the Routing Engine (with the **Sole Exception** of MasterAI's synchronous MCP control calls).

## 27. Client-Side Streaming Endpoint
[UPDATED — System observability architecture upgrade to pure event-driven UI updates, replacing polling]
- **Endpoint**: `GET /api/system/events/stream`
- **Mechanism**: Server-Sent Events (SSE)
- **Purpose**: Provides real-time forwarding of internal events to connected UI clients.
- **Heartbeat**: 20 seconds ping interval tracking active clients.
