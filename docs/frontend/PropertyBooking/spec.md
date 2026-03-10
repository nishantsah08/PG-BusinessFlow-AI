# PropertyBooking Specification

## Purpose
Provide an operations console for the `Property & Booking` domain so teams can manage property inventory, booking visibility, electric meter operations, and maintenance execution from one route (`/property`).

## Scope
- Render and preserve the 4 required sections:
  - Property Management
  - Booking Overview
  - Electric Meters
  - Maintenance
- Allow operators to switch sections without leaving `/property`.
- Drive all reads and mutations through Admin Adapter path via MasterAI execution endpoint.
- Require PIN-first address capture for property create/update and persist structured address fields.
- Support property thumbnail selection and deterministic thumbnail rendering in list/header views.
- On entering edit mode, prefill all available property fields and preserve image context when a single-property refresh payload is partial.
- Treat all Property Management fields as mandatory on create/update except `Google Business Link`; `Save Property` must remain blocked until required fields and at least one image (new upload or existing property image) are present.
- Support explicit enable/disable flows for properties and units:
  - `enable_property`, `disable_property`, `enable_unit`, `disable_unit`
  - Disabled entities must be clearly visible and blocked from live mutations.
- Present property-level edit/enable-disable/delete actions inside a top-right overflow menu.
- Present unit-level edit/enable-disable/delete actions inside each unit overflow menu, with an active-state toggle in-menu.
- Hide hard-delete actions when backend `can_delete` is false and retain audit-safe disabled records instead.
- Property cards present only the operational status (`Enabled` / `Disabled`) in management views; the internal lifecycle `ACTIVE` label is not shown there.
- Show expanded unit rate-card inputs in Unit create/edit (notice period, minimum stay, early-exit rule) in addition to base rent/security deposit/payment/timings/maintenance.
- Show and persist `payment_cycle_rules` in the unit rate-card form through a controlled monthly-cycle selector, while rendering the two customer-facing monthly payment windows as explicit summary text and preserving the same stored string payload.
- Support date-range filtering for Booking Overview trend charts.
- Support optional remarks on maintenance status updates (remarks improve audit traceability, but are not mandatory for status transitions).
- Display failures in centered blocking dialogs.

## Inputs
None via props. Component state is internal and section-specific.

## Outputs
- Property lifecycle actions (create/update/delete property, add/update/delete unit, amenity updates).
- Property disable-state actions (`enable_property`, `disable_property`, `enable_unit`, `disable_unit`).
- Booking visibility dashboards (capacity, occupancy, churn, floor-level layout).
- Electric meter lifecycle actions (register meter, record reading, delete meter).
- Maintenance lifecycle actions (log request, progress status updates).

## Dependencies
- `PropertyManagementView`
- `BookingOverviewView`
- `MetersView`
- `MaintenanceView`

## Failure Modes
- Endpoint failures are handled per section and should never crash the route shell.
- Empty datasets must render an explicit empty state per section.
- Stale or partial `get_properties` payloads for a property should not disable required validation in edit mode when previously-loaded field context still exists.
- Disabled properties/units should continue to be displayed but cannot be mutating targets for live operations.

## Limitations
- Section state is in-memory and is not persisted across hard refresh.
- Cross-section workflows are eventual-consistency based on API refresh calls, not real-time subscriptions.
- Image upload in Property Management uses `/api/upload/images` before submitting tool payload via MasterAI.
