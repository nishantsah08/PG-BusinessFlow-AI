# PropertyBooking Change Log

**Version 1.0.0**
- Date: 2026-03-04
- Change: Added formal frontend documentation set for Property & Booking (`spec`, `contract`, `states`, `decisions`, `change_log`).
- Reason: Align implemented 4-section GUI surface with documentation governance and testing traceability requirements.

**Version 1.1.0**
- Date: 2026-03-04
- Change: Updated backend contract to Admin Adapter path via `/api/master_ai/tools/execute` for Booking Overview and Electric Meters.
- Reason: Enforce MasterAI policy-gated execution consistency for Property & Booking operations.

**Version 1.2.0**
- Date: 2026-03-04
- Change: Replaced outdated “mixed endpoint strategy” decision with Admin Adapter-only execution path.
- Reason: Keep design rationale aligned with implemented architecture and policy enforcement.

**Version 1.3.0**
- Date: 2026-03-04
- Change: Enhanced Property Management with PIN-first address capture, thumbnail selection, and structured address persistence.
- Reason: Improve operational data quality and make listing/header visuals deterministic.

**Version 1.4.0**
- Date: 2026-03-04
- Change: Added Booking Overview date filters for occupancy/churn charts.
- Reason: Allow business users to inspect trend windows without leaving the dashboard.

**Version 1.5.0**
- Date: 2026-03-04
- Change: Redesigned Maintenance ticket operations with expandable cards, remarks history, and blocking failure dialogs with explicit reasons.
- Reason: Provide business-readable failure handling and maintain maintenance audit traceability.

**Version 1.5.1**
- Date: 2026-03-05
- Change: Synced doc language with backend behavior after PropertyAI maintenance and tenant-context updates.
- Reason: Status updates are now valid without mandatory remarks, and tenant context is now explicitly tenant-scoped in local persistence.
