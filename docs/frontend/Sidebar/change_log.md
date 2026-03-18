# Sidebar Change Log

**Version 1.0.0**
- Date: 2026-02-24
- Change: Initial module creation.
- Reason: The App layout was reorganized. Transitioned from a flat top-bar-only navigation to a dual-axis layout (TopBar + Sidebar) to accommodate more system agent monitoring tools and specific views without clutter.

**Version 1.1.0**
- Date: 2026-02-26
- Change: Renamed "Workflow Monitor" tab to "Workflows". Changed route from `/monitor` to `/workflows`. Swapped `Activity` icon to `GitBranch`.
- Reason: The tab now hosts the Workflow Builder (define/edit/delete business-process definitions) rather than just a monitor view.

**Version 1.2.0**
- Date: 2026-02-26
- Change: Integrated `DeveloperModeContext` to conditionally render the "Agent Dashboard" link.
- Reason: Hide developer-specific routing links when the user turns off Developer Mode.

**Version 1.3.0**
- Date: 2026-03-04
- Change: Added CRM route link (`/crm`) to primary navigation.
- Reason: Expose Lead 360 console as a first-class operational surface in the authenticated shell.

**Version 1.4.0**
- Date: 2026-03-04
- Change: Added first-class HR (`/hr`) and Finance (`/finance`) navigation links; removed Communications from top-level sidebar surface.
- Reason: Align left navigation with current business operating modules.
