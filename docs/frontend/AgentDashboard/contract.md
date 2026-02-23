# AgentDashboard API Contracts

## Fetch Agents

**Endpoint:** `GET /api/system/agents`
**Method:** GET
**Payload:** None
**Response schema:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "name": "string",
        "status": "online" | "offline" | "quarantined",
        "last_heartbeat": "ISO-8601 string",
        "latency_ms": number,
        "last_error": "string | null"
      }
    ]
  },
  "correlation_id": "string",
  "latency_ms": number
}
```
**Error schema:** standard `apiClient` error object.
**Timeout behavior:** Fallback to `StateWrapper` error view.

---

## Control Agent

**Endpoint:** `POST /api/system/agent/control`
**Method:** POST
**Payload:**
```json
{
  "agent_name": "string",
  "action": "enable" | "disable" | "restart" | "quarantine"
}
```
**Response schema:**
```json
{
  "success": true,
  "data": {
    "status": "string",
    "message": "string"
  },
  "correlation_id": "string",
  "latency_ms": number
}
```
**Error schema:** standard `apiClient` error object.
**Timeout behavior:** Revert optimistic UI state and display Toast Error.
