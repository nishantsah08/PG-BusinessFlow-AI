# LatencyDisplay State Behaviors

Conforms strictly to the 5 mandatory UI states via `StateWrapper`.

## 1. empty
- **Trigger:** Initial mount where `logs` array length is 0.
- **Behavior:** Renders the "No API requests have been made yet." empty state message. 

## 2. loading
- **Trigger:** N/A natively. Since data is passed synchronously via props, this component does not trigger its own loading spinner.
- **Behavior:** Effectively skipped.

## 3. success
- **Trigger:** `logs` array length > 0.
- **Behavior:** `StateWrapper` renders the array of `RequestLogItem` components.

## 4. error
- **Trigger:** N/A natively. The component does not make API calls. Prop formatting errors throw React boundary exceptions instead.
- **Behavior:** Effectively skipped.

## 5. retry
- **Trigger:** N/A. No API retry needed for sync prop data.
