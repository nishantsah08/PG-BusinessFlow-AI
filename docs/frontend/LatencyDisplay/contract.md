# LatencyDisplay Interface Contract

## Component Props
```typescript
interface LatencyDisplayProps {
  logs: Array<{
    correlationId: string;
    latencyMs: number;
    success: boolean;
    endpoint: string;
    errorMessage?: string;
  }>;
}
```

## Backend API Contract

**Endpoint:** N/A  
**Method:** N/A  
**Payload:** N/A  
**Response schema:** N/A  
**Error schema:** N/A  
**Timeout behavior:** N/A  

*(This component is strictly a consumer of local props passed from the orchestrator and does not interact with the backend directly).*
