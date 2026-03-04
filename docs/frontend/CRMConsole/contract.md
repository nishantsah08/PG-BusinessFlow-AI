# CRMConsole Interface Contract

## Component Props
None.

## Route Contract
- Route: `/crm`
- Parent shell: `Shell` layout (`TopBar` + `Sidebar` + routed main panel)

## Backend Contract
### Auth Context
- `GET /api/auth/context`
- Purpose: Resolve trusted `profile_type` and role permissions for UI capability gating.

### Admin Adapter Execution
- `POST /api/master_ai/tools/execute`
- Required payload shape:
  - `agent_name: "CRMAgent"`
  - `tool_name: string`
  - `parameters: object`

### Read Tools
- `get_dashboard_stats`
- `get_recent_leads`
- `search_leads`
- `get_lead`

### Allowed Mutation Tools (UI)
- `update_lead_snapshot`
- `change_status` (must include non-empty `reason`)
- `add_manual_note`
- `add_secondary_phone`
