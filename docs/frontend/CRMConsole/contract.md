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
- `get_merge_candidates`
- `get_recent_leads`
- `search_leads`
- `get_lead`
- `get_lead_artifacts`

### Dashboard Data Contract
- `get_dashboard_stats` returns lifecycle counts plus `pending_follow_up`.

### Merge Review Contract
- `get_merge_candidates` returns backend-flagged candidate pairs for CEO review in the overview queue.
- Each candidate includes compare-ready `source`, `target`, `confidence`, and `reasons`.

### Allowed Mutation Tools (UI)
- `update_lead_snapshot`
- `change_status` (must include non-empty `reason`)
- `add_secondary_phone`
- `merge_leads` (CEO-capable roles only)
