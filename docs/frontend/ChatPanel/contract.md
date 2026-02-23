# ChatPanel Interface Contract

## Component Props
```typescript
interface ChatPanelProps {
  onLogRequest: (log: RequestLogItemProps) => void;
}
```

## Backend API Contract

**Endpoint:** `/api/master_ai/chat`  
**Method:** `POST`  
**Timeout behavior:** Default fetch timeout (typically 30s-60s depending on browser/fetch implementation, no custom abort controller overrides currently).  

**Payload:**
```json
{
  "message": "string"
}
```

**Response schema:**
```json
{
  "success": true,
  "data": {
    "reply": "string",
    "message": "string (optional fallback)"
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
  "error": "string (Detailed error message from MasterAI or local network failure)",
  "correlation_id": "string",
  "latency_ms": 123
}
```
