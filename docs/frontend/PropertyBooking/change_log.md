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

**Version 1.5.2**
- Date: 2026-03-07
- Change: Stabilized Property edit startup by re-hydrating the edit form from a fresh `get_properties` payload on Enter Edit, and added required-field markers for mandatory fields.
- Reason: Prevented UI false-negatives where required values appeared empty and blocked save during name-only field edits.

**Version 1.5.3**
- Date: 2026-03-07
- Change: Preserved existing `image_urls` during edit prefill when a session's `get_properties` response omits them.
- Reason: Prevented `Save Property` from staying disabled due temporary data-shape drift between list and single-property responses.

**Version 1.5.4**
- Date: 2026-03-07
- Change: Hardened property edit prefill so thumbnail-only properties and `image_urls: []` responses no longer clear existing image context on entering edit mode.
- Reason: Keeps `Save Property` enabled and avoids false required-image blocks when backend responses are incomplete or stale.

**Version 1.5.5**
- Date: 2026-03-07
- Change: Prioritized tenant resolution from CEO email over stale `master_ai_user.tenant_id` during Property tool calls.
- Reason: Prevented accidental cross-tenant reads (e.g., `default` tenant) that produced empty image payloads and blocked edit saves.

**Version 1.5.6**
- Date: 2026-03-07
- Change: Made all Property Management fields mandatory on create/update except `Google Business Link`, and added required-field indicators for those fields.
- Reason: Prevents partially filled edit states from silently disabling `Save Property`, aligning form validation with business requirement and improving user correction flow.

**Version 1.5.7**
- Date: 2026-03-09
- Change: Added property/unit enable-disable controls and expanded disabled-state behavior in Property Management.
- Reason: Supports audit-safe records for operationally blocked entities and keeps live operations from running on disabled properties/units.

**Version 1.5.8**
- Date: 2026-03-10
- Change: Moved property and unit edit/enable-disable/delete actions into overflow menus, added escape-close handling, surfaced unit `payment_cycle_rules`, and hid delete where backend marks `can_delete=false`.
- Reason: Tightens operator UX, aligns delete visibility with audit-safe retention policy, and exposes the full public rate-card rule set during unit management.

**Version 1.5.9**
- Date: 2026-03-10
- Change: Simplified Property Management presentation to show only `Enabled` / `Disabled` on property cards, removed the internal property id from the selected-property ribbon, kept the business description visible there, and converted unit `payment_cycle_rules` input from free text to a business-policy dropdown.
- Reason: Reduces operational noise, preserves business context for operators, and makes payment-cycle selection controlled without changing backend logic.

**Version 1.5.10**
- Date: 2026-03-10
- Change: Reframed unit `payment_cycle_rules` as a monthly payment-cycle selector with explicit 1st-5th and 6th-10th customer-facing summary lines, and normalized older stored rule strings to the monthly wording.
- Reason: Aligns the public unit rate card with the actual billing-cycle business rule while keeping payload compatibility for existing units.
