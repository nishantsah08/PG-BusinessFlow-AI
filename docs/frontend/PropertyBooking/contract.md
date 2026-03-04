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
  - Tools: `get_properties`, `add_property`, `update_property`, `delete_property`, `get_units`, `add_unit`, `update_unit`, `delete_unit`
  - Supporting upload endpoint: `/api/upload/images`
- Booking Overview
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_properties`, `get_units`, `get_analytics_stats`
- Electric Meters
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_properties`, `get_units`, `get_meters`, `add_meter`, `update_meter_reading`, `delete_meter`
- Maintenance
  - `/api/master_ai/tools/execute` with `agent_name=PropertyAI`
  - Tools: `get_analytics_stats`, `get_properties`, `get_maintenance_reqs`, `log_maintenance_req`, `update_maintenance_req`
