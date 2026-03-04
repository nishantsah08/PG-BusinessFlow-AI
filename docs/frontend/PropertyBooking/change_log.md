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
