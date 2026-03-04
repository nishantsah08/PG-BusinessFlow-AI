# PropertyBooking State Behaviors

## 1. empty
- Trigger: A section receives no records from backend (for example, no properties, no units, no meters, no tickets).
- Behavior: Render section-specific empty-state guidance; app shell remains interactive.

## 2. loading
- Trigger: Initial section mount or section refresh after a mutation.
- Behavior: Render loading indicators/spinners local to the active section.

## 3. success
- Trigger: Section APIs return valid payloads.
- Behavior: Render interactive lists, charts, forms, and action controls.

## 4. error
- Trigger: API call fails or malformed payload causes fetch pipeline failure.
- Behavior: Log section error and preserve route operability so operator can continue or retry.

## 5. retry
- Trigger: User reattempts action after failure (resubmit form, switch section, or reload route).
- Behavior: Section reissues API reads/writes and transitions back through loading.
