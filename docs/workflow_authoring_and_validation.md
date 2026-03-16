# Workflow Authoring And Validation

## Purpose

Define one control-plane model for how the system stores, drafts, validates, publishes, archives, and executes business procedures.

Business users should experience these as `SOPs`.
The backend should continue to store and execute them as versioned `workflow` definitions.

---

## Naming Rule

```text
Business-facing term: SOP
Backend/system term: Workflow
```

Meaning:

- the GUI should speak in SOP language,
- the runtime and storage layers may still use workflow terminology,
- one SOP version maps to one workflow version.

---

## Lifecycle Model

Every workflow family must follow this lifecycle:

```text
System Template
Tenant Draft
Tenant Published
Archived Snapshot
```

### Meaning

- `System Template`
  - protected default shipped by the platform
  - used as the effective runner until the tenant publishes its own version

- `Tenant Draft`
  - tenant-owned working copy
  - editable through the GUI SOP workspace
  - not executable

- `Tenant Published`
  - approved tenant version
  - executable
  - only one active published version may exist per tenant per workflow family

- `Archived Snapshot`
  - historical copy retained for audit and reference
  - not executable

### Core lifecycle rules

- published versions are never hard-deleted
- replacing a published version archives the previously active published version
- drafts may be discarded
- runtime executes only:
  - the tenant's active published version, or
  - the protected system template if no tenant published version exists

---

## Governance Surface Rule

Workflow/SOP governance is GUI-only.

Allowed governance surface:

- SOP workspace in the authenticated portal

Not allowed:

- free-floating MasterAI chat
- domain forms without the SOP workspace approval flow

WhatsApp may still be used as a downstream communication channel from a workflow.
It may be used to list, explain, check status, or review validation for SOPs, but it must not be used to create, edit, clone, publish, archive, activate, or deactivate SOP/workflow definitions.

---

## SOP Workspace Model

The SOP workspace must use this shape:

```text
Left side  = SOP document
Right side = SOP-scoped assistant chat
Top actions = Save Draft / Validate / Publish
```

### Left side

The left side is a business-readable SOP document.
It should read like an operating procedure, not like raw execution config.

Recommended sections:

```text
Business outcome
When this runs
Who can initiate and approve
Detailed flow
Preconditions
Failure and rollback policy
Scope and ownership
```

### Right side

The right side uses the same business context engine as `MasterAI`, but it is scoped to the selected SOP only.
It must load the wider business context needed to write good SOPs, including current CRM, HR, Property, Finance, and visible SOP state for the tenant.

The SOP assistant may:

- explain the selected SOP
- answer questions about the selected SOP
- draft a new SOP
- propose edits to a draft
- compare draft vs active version
- explain validation failures

The SOP assistant may not:

- edit a workflow outside the selected SOP context
- publish automatically
- archive automatically
- bypass validation

### New SOP creation

When a user starts a new SOP:

- the SOP document starts blank
- the chat thread starts blank
- the first assistant response should come only after the user describes the SOP they want

---

## Writing Standard For SOP Text

Each SOP should be written so a CEO, operator, or reviewer can understand it without knowing system internals.

Avoid leading with terms like:

- workflow family
- ledger-backed
- CRM projection
- protected default
- ambiguous scope

Prefer business language such as:

- record the final billing entries in Finance
- hand off to communication systems
- system default SOP
- billing scope is clear

If technical detail matters, it should appear in an `Advanced` or hidden system section, not in the primary SOP body.

---

## Validation Standard

No SOP should go live only because it was described.

It must pass validation before publish.

### Every draft must validate:

- required SOP sections are present
- business outcome is clear
- trigger/run timing is clear
- approval rule is clear
- failure handling is defined
- the linked workflow definition is structurally valid

### Finance drafts must additionally validate:

- deterministic execution path exists
- approval is mandatory
- rollback or compensation policy is mandatory
- finance truth is written in a controlled order
- downstream communication failure does not erase finance truth

---

## Assistant Change Flow

The assistant must work through proposal and confirmation.

```text
User asks for a change
-> assistant returns a proposal
-> user applies or discards
-> draft updates
-> validation runs
-> user publishes
```

The assistant should not silently rewrite the SOP document.

---

## Runtime Rule

The runtime executes the active published workflow version for that tenant and workflow family.

Execution must not use:

- drafts
- archived snapshots
- guessed workflow identity

For finance workflows:

- if finance truth is not yet written and a precondition fails, abort cleanly
- if finance truth has already been written and downstream communication fails, preserve finance truth and handle communication failure as follow-up work

---

## Storage Model

The preferred model is one versioned workflow record containing both:

- the business-readable SOP document
- the executable workflow definition

Recommended per-version fields:

```text
workflow_id
workflow_family
tenant_id
version
version_type
sop_document
workflow_definition
approval
confidence
rollback_policy
validation_report
created_at
published_at
archived_at
clone_of_workflow_id
```

This keeps the SOP and the executable workflow in sync.

---

## Visible UI States

Business users should see only:

- `Active`
- `Draft`
- `Archived`
- `All`

Internal state may be richer, but it should collapse into those business states in the GUI.

---

## Locked Finance SOP Baseline (Current Scope)

The current Finance SOP program is locked to this business-facing set:

1. `Record Booking Hold`
2. `Expire Booking Hold`
3. `Onboard Tenant`
4. `Generate Monthly Bills`
5. `Rent Collection`
6. `Record Outgoing Transaction`
7. `Offboard Tenant`
8. `Correct Finance Entry`

Execution and governance rules for this locked scope:

- SOP text is business-readable in the left document view.
- Mutation governance remains GUI-only.
- WhatsApp may report payment intent/status, but may not author or mutate SOP governance.
- `Correct Finance Entry` is CEO-only and must use compensating records only.
- `Generate Monthly Bills` runs month-end and supports controlled reruns without duplicate send for the same tenant and billing month.
- `Rent Collection` follows scheduled reminder windows and explicit CEO approval gates for posting customer-reported payment.
- `Offboard Tenant` closes only after settlement movement is completed and final customer communication is sent.
- Finance action buttons in `/finance` must read effective workflow contracts from `GET /api/finance/button-contracts` so required fields and workflow linkage stay aligned with the active SOP/workflow version.
- Finance action popups in `/finance` must render inputs from contract `field_schema` (with generic fallback for newly introduced context keys) and submit only active contract `context_keys`.

---

## Non-Goals

This model does not require:

- exposing workflow IDs in the primary SOP view
- exposing raw machine step params in the business UI
- allowing WhatsApp workflow governance
- keeping legacy clone/activate/deactivate/delete language in the business product
