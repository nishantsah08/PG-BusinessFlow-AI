# RequestLogItem Interface Contract

## Component Props
```typescript
export interface RequestLogItemProps {
  correlationId: string;
  latencyMs: number;
  success: boolean;
  endpoint: string;
  errorMessage?: string;
}
```

## Backend API Contract

**Endpoint:** N/A  
**Method:** N/A  
**Payload:** N/A  
**Response schema:** N/A  
**Error schema:** N/A  
**Timeout behavior:** N/A  

*(This component is a stateless presentational generic and does not interact with the backend).*
