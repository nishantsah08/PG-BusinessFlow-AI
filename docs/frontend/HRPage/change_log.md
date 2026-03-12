# HRPage Change Log

**Version 1.0.0**
- Date: 2026-03-04
- Change: Introduced `/hr` as first-class module with employee list and modal-driven add/edit/rate-card operations.
- Reason: Expose HR workflows as business-operational surface instead of embedded/secondary UI.

**Version 1.1.0**
- Date: 2026-03-04
- Change: Added demo fallback dataset and business-safe notice when live HR reads fail.
- Reason: Preserve testability and continuity during partial backend/tool outages.

**Version 1.2.0**
- Date: 2026-03-11
- Change: Replaced the prior utility HR screen with a desktop-first redesign preview featuring a protected CEO owner card, workforce summary, employee roster, employee detail panel, and preview action drawers.
- Reason: Establish the new information architecture and visual hierarchy for HR before reconnecting the page to live MasterAI/HR workflows.

**Version 1.3.0**
- Date: 2026-03-11
- Change: Wired the HR page back to live HR tools, merged the account owner into the same people roster as employees, defaulted the roster to current people only, and added `MasterAI` orchestration for `staff.hired -> CRM Staff sync`.
- Reason: Deliver the real HR operating flow while keeping the owner visible in context and preserving the system rule that cross-agent communication routes through `MasterAI`.

**Version 1.3.1**
- Date: 2026-03-11
- Change: Added `staff.profile_updated -> MasterAI -> CRM` sync so HR profile edits refresh the CRM staff snapshot and make edited staff phone numbers searchable through CRM lookup.
- Reason: Keep HR and CRM aligned after employee contact changes instead of only syncing on first hire.

**Version 1.4.0**
- Date: 2026-03-11
- Change: Changed new-hire compensation from a manual post-hire salary-card step to designation-driven auto-provisioning, while keeping a review/override flow for person-specific compensation edits.
- Reason: Match the intended business workflow where caretaker and staff incentives are defined by business rules before individual hiring starts.

**Version 1.4.1**
- Date: 2026-03-12
- Change: Reduced the live HR hire flow to the caretaker template only, fixed invalid-hire feedback so bad input no longer appears to save silently, tightened the roster search/filter layout, and split compensation review from bank-details editing.
- Reason: Match the current business truth around caretaker compensation and make the live GUI behave clearly during real operator use.

**Version 1.4.2**
- Date: 2026-03-12
- Change: Moved invalid-hire feedback into the add-employee modal itself and converted compensation review into a labeled form for clearer salary and incentive editing.
- Reason: Make the operator path readable and remove ambiguity between failed input and successful save.

**Version 1.4.3**
- Date: 2026-03-12
- Change: Standardized all HR action modals onto the same left-label/right-input form layout, kept caretaker compensation formula read-only, and made long modals scroll safely so save actions stay reachable.
- Reason: Make the live desktop HR flow consistent, readable, and operable during real data entry.

**Version 1.4.4**
- Date: 2026-03-12
- Change: Removed the workforce summary strip from the desktop HR screen and moved all HR popups onto a shared high-priority modal shell so each popup stays fully visible above the app layout.
- Reason: Keep the page focused on people operations and remove popup clipping during real operator use.
