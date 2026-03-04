# CRMConsole State Behaviors

## 1. empty
- Trigger: No leads returned or selected lead has no timeline events.
- Behavior: Render explicit empty-state guidance while keeping all controls usable.

## 2. loading
- Trigger: Initial dashboard hydration and lead-detail refresh after mutations.
- Behavior: Render loading placeholders/text in list/detail surfaces.

## 3. success
- Trigger: Valid lead and timeline payloads returned.
- Behavior: Render KPI strip, lead list, detail metadata, and timeline cards.

## 4. error
- Trigger: Any Admin Adapter read/mutation failure.
- Behavior: Render inline error message and keep route interactive for retry.

## 5. retry
- Trigger: User re-submits failed action or refreshes dashboard.
- Behavior: Re-issue request and transition through loading back to success/error.
