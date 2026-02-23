# DecisionTraceViewer Interface Contract

## Component Props
```typescript
interface DecisionTraceViewerProps {
  traceId: string | null;
  onLogRequest: (log: RequestLogItemProps) => void;
}
```

## Backend API Contract

**Endpoint:** `/api/master_ai/trace/:id`  
**Method:** `GET`  
**Timeout behavior:** Standard fetch timeout. Does not eagerly abort.

**Payload:** URL Path parameter `id` (string).

**Response schema:**
```json
{
  "success": true,
  "data": {
    "plan": "object (optional)",
    "sub_tasks": [
      {
         "agent": "string",
         "instruction": "string",
         "status": "string (completed | pending | failed)"
      }
    ]
  },
  "error": null,
  "correlation_id": "string",
  "latency_ms": 123
}
```

**Error schema:**
```json
{
  "success": false,
  "data": null,
  "error": "string (Includes '404' substring for missing traces)",
  "correlation_id": "string",
  "latency_ms": 123
}
```
