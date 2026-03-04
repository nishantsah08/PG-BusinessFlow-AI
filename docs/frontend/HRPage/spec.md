# HRPage Specification

## Purpose
Provide a first-class HR operations module on route `/hr` for employee lifecycle and rate-card management.

## Scope
- Render employee list with selection context.
- Open Add Employee, Edit Employee, and Rate Card as blocking modals.
- Execute HR reads/mutations through Admin Adapter path via `/api/master_ai/tools/execute`.
- Fall back to demo records when live HR read is unavailable.

## Inputs
None via props. Uses authenticated context and internal state.

## Outputs
- `get_all_staff`, `get_salary_card`, `hire_staff`, `update_staff_profile`, `create_salary_card`, `update_salary_card`.

## Failure Modes
- Permission/read failures show non-technical business notice.
- UI remains interactive under fallback mode.
