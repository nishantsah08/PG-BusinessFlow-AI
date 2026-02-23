# RequestLogItem State Behaviors

Does not conform to the 5 mandatory UI states directly, as it is a stateless child presentational component intended to be rendered *inside* a `StateWrapper`.

## Render States

### 1. Success
- **Trigger:** `success === true` prop
- **Behavior:** Renders a green checkmark icon, green border styling, and omits the error message block.

### 2. Failure
- **Trigger:** `success === false` prop
- **Behavior:** Renders a red cross icon, red border styling, and conditionally renders the `errorMessage` block if provided.
