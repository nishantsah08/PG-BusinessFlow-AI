# CRMConsole Change Log

**Version 1.0.0**
- Date: 2026-03-04
- Change: Added Lead 360 module docs (`spec`, `contract`, `states`, `decisions`, `change_log`).
- Reason: Document newly implemented CRM route and Admin Adapter execution boundaries.

**Version 1.1.0**
- Date: 2026-03-04
- Change: Added role-aware auth context contract (`/api/auth/context`) and permission-gated action model.
- Reason: Align UI capability locks with authoritative backend role resolution.

**Version 1.2.0**
- Date: 2026-03-04
- Change: Added resilient lead hydration fallback (`get_lead_by_phone` + `get_timeline`) when `get_lead` is unavailable.
- Reason: Keep CRM Lead 360 operational under mixed backend capability states.

**Version 1.3.0**
- Date: 2026-03-11
- Change: Reworked CRM route to `overview + leads workspace + drawer` model, added pending follow-up KPI, backend merge-candidate queue read contract, and CEO-only GUI merge approval path.
- Reason: Align the CRM surface with CommunicationsAI-first operations while keeping GUI limited to readable review, safe edits, and CEO decision support.
