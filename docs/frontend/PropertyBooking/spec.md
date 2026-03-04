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

## Inputs
None via props. Component state is internal and section-specific.

## Outputs
- Property lifecycle actions (create/update/delete property, add/update/delete unit, amenity updates).
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

## Limitations
- Section state is in-memory and is not persisted across hard refresh.
- Cross-section workflows are eventual-consistency based on API refresh calls, not real-time subscriptions.
- Image upload in Property Management uses `/api/upload/images` before submitting tool payload via MasterAI.
