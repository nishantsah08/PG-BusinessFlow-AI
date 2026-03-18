# PropertyBooking Interface Contract

## Component Props
None.

## Route Contract
- Route: `/property`
- Parent shell: `Shell` layout (`TopBar` + `Sidebar` + routed main panel)

## Section Contract
The page must render 4 tab controls and corresponding view surfaces:
1. `Property Management`
2. `Booking Overview`
3. `Electric Meters`
4. `Maintenance`

## Backend Contract (Section-level)
- Property Management
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_properties`, `add_property`, `update_property`, `delete_property`, `enable_property`, `disable_property`, `get_units`, `add_unit`, `update_unit`, `enable_unit`, `disable_unit`, `delete_unit`
  - Supporting upload endpoint: `/api/upload/images`
  - UI action contract: property ribbon actions and unit actions are surfaced via overflow menus, not always-visible inline buttons.
  - State contract: property/unit listings consume `is_enabled` and `can_delete` to render operational state and delete eligibility.
  - Presentation contract: management cards display only `Enabled` / `Disabled`; the selected-property header omits the internal property id ribbon but keeps the business description.
  - Rate card contract: unit `payment_cycle_rules` is chosen from a controlled monthly-cycle selector; the UI also renders the 1st-5th and 6th-10th monthly payment windows as explicit customer-facing summary text, while the persisted payload remains the same string field.
  - Delete behavior: active financial history or linked constraints keep entities disabled and non-deletable.
  - Disabled entity behavior: disabled properties/units are kept for audit and are blocked from live mutations.
- Booking Overview
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_properties`, `get_units`, `get_analytics_stats`
  - Current GUI contract: analytics-only; booking creation/edit/onboarding is not exposed as a first-class CRUD flow on this route.
- Electric Meters
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_properties`, `get_units`, `get_meters`, `add_meter`, `update_meter_reading`, `delete_meter`
  - Meter linking guard: disabled and deleted units cannot be linked.
  - UI state contract: selected-property unit options must come only from the latest `get_units(property_id)` response for the active property filter.
- Maintenance
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_analytics_stats`, `get_properties`, `get_maintenance_reqs`, `log_maintenance_req`, `update_maintenance_req`
  - UI state contract: ticket logging requires explicit property context; unit lookup and submission must resolve within the selected property only.
