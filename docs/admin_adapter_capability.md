# Admin Adapter Capability Contract

## 1. Purpose

The Admin Adapter is the structured control channel used by internal operators (CEO/authorized staff) to perform low-risk, isolated system updates through MasterAI.

Primary intent:
- Enable fast operational corrections.
- Avoid conversational ambiguity.
- Prevent cross-agent state drift.

## 2. Execution Path

`Admin GUI -> /api/master_ai/tools/execute -> MasterAI policy gate -> Target Agent Tool`

The Admin Adapter does not bypass MasterAI. MasterAI remains the only execution authority.

## 3. Capability Scope (Allowed)

Allowed operations are deterministic, single-tool updates that do not require multi-agent transaction orchestration.

Examples of allowed operation classes:
- CRM snapshot field updates (email, preferences, source, unit type requirement, AI notes).
- CRM lead retrieval, search, timeline read.
- CRM note append and artifact link append.
- Controlled status changes with reason.
- Property metadata corrections that are single-entity and non-financial.

## 4. Out of Scope (Not Allowed)

The Admin Adapter must not directly execute high-risk, multi-step, or financial-critical mutations without workflow controls.

Disallowed classes:
- Multi-agent orchestration requiring compensation logic.
- Financial ledger-impacting operations without authorization workflow.
- Bulk destructive mutations.
- Identity-destructive changes without explicit high-trust policy.

## 5. Safety Guardrails

All Admin Adapter operations must satisfy:
- Tool allowlist per role (`CEO`, `Staff`).
- Strict schema validation (typed payloads only).
- Reason requirement for status/structural changes.
- Full audit envelope (`actor`, `request_id`, `correlation_id`, before/after where applicable).
- Idempotency key for retry-safe mutation paths.

## 6. Synchronization Rule

Admin Adapter actions must remain isolated by default.

Rule:
- If a requested action can create cross-agent inconsistency, route it to a defined workflow instead of direct admin execution.

## 7. Decision Matrix

Use Admin Adapter when:
- Operation is a one-off correction.
- Tool call is deterministic and scoped to one bounded context.
- No compensating transaction logic is required.

Use Workflow/Conversational orchestration when:
- Operation spans multiple systems.
- Financial or compliance implications require staged authorization.
- Rollback/compensation may be required.

## 8. Practical Examples

Good Admin Adapter use:
- Update lead email in CRM.
- Add secondary phone to an existing lead.
- Change lead status from `Enquiry` to `Visited` with reason.
- Add a manual CRM note after an offline visit.
- Link signed KYC artifact to lead timeline.

Should go to workflow (not direct admin adapter):
- Tenant onboarding that touches CRM + Property + Finance.
- Security deposit settlement adjustments.
- Multi-record migration or mass archival.
- Any mutation that can produce partial completion across agents.
