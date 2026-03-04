# RequestLogItem Design Decisions

## 1. Single Responsibility
- **Why built this way:** Ensures that every Phase 2 component displaying network execution shares the exact same visual signature. 
- **Alternatives considered:** Adding the JSX for latency tags directly into `ChatPanel` bubbles.
- **Why rejected:** Violates DRY design, leads to visual drift over time if only one component's styles are updated.
- **Assumptions made:** The specified 4 transparent dimensions (latency, correlation, status, endpoint) are the *only* required data points.

## 2. Exemption from `StateWrapper`
- **Why built this way:** Serves purely as a presentational item to be mapped inside an *already wrapped* parent collection (like `LatencyDisplay`).
- **Alternatives considered:** Adding `StateWrapper` to each individual log item.
- **Why rejected:** Causes nested state collisions and requires each UI element to track internal load/empty states, which is nonsense for a synchronous prop consumer.
- **Assumptions made:** Parent components handle mapping edge cases.
