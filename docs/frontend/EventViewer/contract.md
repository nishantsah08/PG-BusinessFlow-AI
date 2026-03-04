# EventViewer Interface Contract

## Component Props
```typescript
interface EventViewerProps {
  onLogRequest: (log: RequestLogItemProps) => void;
}
```

## Backend API Contract

**Endpoint:** `/api/master_ai/events?limit=20`  
**Method:** `GET`  
**Timeout behavior:** Sync blocks UI on manual refresh; silent background polling fails quietly after standard browser fetch timeout. No hard abort deadline.

**Payload:** None (Query parameters only: `limit=20`)

**Response schema:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
         "type": "string",
         "timestamp": "string (ISO8601)",
         "message": "string (optional)",
         "payload": "object (optional)",
         "agent_id": "string (optional)"
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
  "error": "string",
  "correlation_id": "string",
  "latency_ms": 123
}
```
