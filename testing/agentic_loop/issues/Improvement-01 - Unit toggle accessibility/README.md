# Improvement-01 - Unit toggle accessibility

## Outcome
- Status: Non-blocking improvement
- Date: 2026-03-10
- Surface: `Property & Booking` -> `Property Management` -> unit overflow menu

## Evidence
- During headed Playwright validation, the unit enable/disable switch proved harder to target reliably than the surrounding menu actions because the interactive checkbox is visually hidden and driven through a label wrapper.
- The user-visible behavior works, but the automation path is more brittle than the property overflow actions.

## Root Cause
- The unit toggle uses an `sr-only` checkbox nested inside a custom switch without a directly visible, stable click target that is easy to target consistently in UI automation.

## Recommendation
- Add a visible button-like target or stronger accessible association for the unit active toggle.
- Example options:
  - expose a visible button with `aria-pressed`
  - add an explicit `id` + `htmlFor` pair and a dedicated test id on the switch wrapper
  - convert the row action into a standard button item (`Enable Unit` / `Disable Unit`) if consistency matters more than inline switch styling

## Business Reason
- This reduces operator ambiguity and lowers browser-test fragility for a critical operational control.
