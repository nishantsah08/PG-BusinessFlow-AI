# System Access Policy

## 1. Purpose

This document defines the system-wide actor access model for all user-channel interactions routed through `MasterAI`.

It exists to keep role behavior consistent across modules such as:

- HR
- CRM
- Finance
- Property
- Communications

This policy applies to:

- GUI chat
- WhatsApp
- Any future user-facing conversational ingress routed through `MasterAI`

For SOP/workflow governance, this policy also applies to the dedicated SOP workspace in the authenticated portal.

---

## 2. Core Principle

Access control is actor-based, scope-based, and deny-by-default.

`MasterAI` is the runtime enforcement point because all meaningful conversational user actions enter through `MasterAI`.

The policy does **not** store personal identity data such as phone numbers or email ids.

Identity data remains owned by:

- `CRM` for lead/customer identity
- `HR` for employee identity
- business tenant configuration for CEO ownership

---

## 3. Actor Model

The system recognizes three actor types:

- `CEO`
- `Staff`
- `Customer`

Meaning:

- `CEO`: Full business-level internal visibility and approval authority.
- `Staff`: Limited internal operational visibility, restricted by module and record scope.
- `Customer`: Public/self-only visibility. No internal business data access.

---

## 4. Identity Resolution

Before any tool exposure or data access decision, `MasterAI` must resolve actor identity from system sources.

Identity resolution uses:

- CRM profile context
- HR staff mapping
- business tenant ownership context

For a newly created business, `CEO` cross-channel identity is not considered active until the owner phone is verified and bound to the tenant. Until then, the workspace remains provisional and protected actions must be denied.

Identity resolution returns a normalized runtime identity such as:

```json
{
  "actor_type": "Staff",
  "tenant_id": "default",
  "lead_id": "+919800001111",
  "staff_id": "STF-01"
}
```

The policy engine consumes this resolved identity. It does not hardcode personal contact data.

---

## 5. Policy Decision Model

For every request, policy is decided in this order:

```text
resolve actor
-> identify module/tool intent
-> check actor permission
-> apply record scope
-> allow or deny execution
```

The policy engine must answer two questions:

1. Is this action allowed?
2. On which records is it allowed?

Both are mandatory.

---

## 6. Scope Model

Scope defines the allowed data boundary after actor permission is known.

Standard scopes:

- `tenant_wide`
- `self_only`
- `public_only`
- `none`

Examples:

- `CEO` -> `tenant_wide`
- `Staff` in HR -> `self_only`
- `Customer` in HR -> `none`
- `Customer` in CRM/Finance -> `self_only`

---

## 7. Enforcement Inside MasterAI

Inside `MasterAI`, policy enforcement must remain structured and centralized.

Recommended internal flow:

```text
Identity Resolver
-> Access Policy Engine
-> Scope Resolver
-> Tool Orchestrator
```

Enforcement must include:

- tool visibility filtering
- scoped argument injection
- deny-by-default behavior for missing or unresolved identity

Prompt wording alone is not sufficient protection. Final access control must be deterministic.

---

## 8. Module Examples

### HR

- `CEO`: Full HR roster and detail visibility.
- `Staff`: Own HR profile, own compensation, own leaves only.
- `Customer`: No HR access.

### CRM

- `CEO`: Full CRM visibility.
- `Staff`: Tenant-wide operational CRM visibility, including lead lookup and status/note updates, but excluding identity-destructive actions.
- `Customer`: Own CRM record only.

### Finance

- `CEO`: Full financial visibility and approval authority.
- `Staff`: Limited operational finance visibility for assigned-unit current-month finance, plus workflow initiation without approval authority.
- `Customer`: Own dues, own payment state, own receipts only.

### Property

- `CEO`: Full property visibility.
- `Staff`: Read-only operational property visibility. No property mutations.
- `Customer`: Public inventory information or own booking context only.

### Current v1 Coverage

The current centralized `MasterAI` policy actively enforces:

- `HR`
- `CRM`
- `Property`
- `Finance`

`Finance` v1 is enforced with a stricter rule than other modules: reads are scope-limited by actor, while all mutations must run through predefined deterministic workflows with CEO approval gates.

---

## 8.1 SOP Governance Boundary

Business-facing SOP management is GUI-only.

Allowed SOP/workflow governance surface:

- authenticated portal SOP workspace

Not allowed:

- public or customer channels
- free-form workflow mutation through broad MasterAI chat

This means WhatsApp must not support governed SOP mutation such as:

- cloning
- drafting
- publishing
- archiving
- discarding
- activation / deactivation
- workflow governance approvals

WhatsApp may support safe SOP assistance such as:

- SOP listing
- SOP detail viewing
- SOP status queries
- SOP validation review

When a user asks to create or change an SOP on WhatsApp, the system must refuse and direct them to the portal because the WhatsApp environment is not conducive for governed SOP work.

WhatsApp may still be used as a downstream delivery channel from an already-published workflow.

---

## 9. Non-Goals

This document does not define:

- detailed module tool matrices
- GUI editing workflows for policy management
- hardcoded personal identifiers

Those should remain separate from the core actor access policy.
