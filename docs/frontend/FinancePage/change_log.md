# FinancePage Change Log

**Version 1.0.0**
- Date: 2026-03-04
- Change: Introduced `/finance` as first-class module with overview, incoming, and outgoing sections.
- Reason: Align financial operations with dedicated module ownership and navigation.

**Version 1.1.0**
- Date: 2026-03-04
- Change: Switched add/edit transaction flows to blocking modal forms and section-level navigation.
- Reason: Standardize business action UX and reduce accidental context loss during data entry.

**Version 1.2.0**
- Date: 2026-03-13
- Change: Made Finance role-aware, added booking-hold and onboarding flows, added vendor register, and moved incoming/outgoing to workflow-backed business forms with unit-aware incoming visibility.
- Reason: Align portal Finance with deterministic workflow execution, booking lifecycle rules, vendor accounting, and the shared application form/popup policy.

**Version 1.3.0**
- Date: 2026-03-16
- Change: Added workflow-linked button contract feed (`/api/finance/button-contracts`) and contract-aware validation for Finance action forms; preserved submit success notices during refresh; added explicit linked-unit override test coverage from booking hold to onboarding.
- Reason: Keep Finance button forms aligned with effective SOP workflow contracts and reduce drift/flaky UX.

**Version 1.4.0**
- Date: 2026-03-16
- Change: Switched Finance action popups to contract-driven field rendering from button `field_schema`; forms now show/hide known fields by active SOP context keys, render generic controls for unknown keys, and submit only active contract context keys.
- Reason: Ensure Finance button forms auto-adapt when SOP/workflow context changes, without requiring manual popup rewiring.
