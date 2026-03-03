# ChatPanel Interface Contract

## Component Props
```typescript
interface ChatPanelProps {
  onLogRequest: (log: RequestLogItemProps) => void;
}
```

## Backend API Contract

**Endpoint:** `/api/communications/chat`  
**Method:** `POST`  
**Timeout behavior:** Default fetch timeout (typically 30s-60s depending on browser/fetch implementation, no custom abort controller overrides currently).  

**Payload (JSON mode):**
```json
{
  "messages": [
    { "role": "user|assistant", "content": "string" }
  ],
  "user": { "email": "string", "name": "string", "type": "string" }
}
```

**Payload (multipart mode for attachments):**
- `messages` (stringified JSON)
- `user` (stringified JSON)
- `attachments` (0..n files)

**Response schema:**
```json
{
  "success": true,
  "data": {
    "content": "string"
  },
  "error": null,
  "correlation_id": "string",
  "latency_ms": 123,
  "uploaded_image_urls": ["/images/....jpg"]
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
