# HRPage Specification

## Purpose
Provide a first-class HR operations module on route `/hr` for employee lifecycle, protected owner visibility, and compensation management.

## Scope
- Render a desktop-first HR operations page with:
  - shared people roster containing the account owner and employees
  - employee detail and compensation panels
  - live add, edit, compensation review, and termination modals for employees
- Keep the account owner visible in the same roster while locking owner email editing from HR.
- Reflect the current default list behavior: owner + active employees first, terminated staff visible through filter.
- New employee creation remains routed through `HRAgent`, with CRM staff profile sync handled by `MasterAI` after `staff.hired`.
- Hiring currently uses a caretaker-only template in the GUI, with compensation auto-provisioned from the caretaker business rules so new hires land in HR with compensation ready by default.
- Compensation review and bank-details editing are split into separate employee actions.
- Invalid caretaker hires must show the error inline inside the add-employee modal so failed input is not mistaken for a saved employee.
- Compensation review uses labeled fields for salary, incentive, allowance, and caretaker-rule values instead of placeholder-only inputs.
- All HR action modals now use the same left-label/right-input form pattern, and caretaker compensation keeps the formula read-only while numeric values stay editable.
- The workforce summary strip is removed from the desktop page, and popup actions must remain fully visible and scroll-safe inside the viewport.
- Employee profile edits also route through `HRAgent`, with `MasterAI` refreshing the CRM `Staff` snapshot after `staff.profile_updated`.

## Inputs
None via props. Uses authenticated context and internal state.

## Outputs
- `get_all_staff`, `get_salary_card`, `hire_staff`, `update_staff_profile`, `terminate_staff`, `create_salary_card`, `update_salary_card`.

## Failure Modes
- Permission/read failures fall back to demo employee data when live HR reads fail.
- Owner email stays visible but not editable from this route.
- When HR changes a staff phone number, CRM keeps the original lead identity and adds the edited number as a valid secondary lookup until full primary-phone migration exists.
