# AI Branching And Delivery Workflow

## Objective

PG-BusinessFlow.ai is being built for external market scale while we also operate as the first internal customer.
The branch strategy must support parallel AI delivery with strict architecture and quality control.

## Branch Structure

Use three layers:

- `main`: release-ready branch only.
- `lane/<domain>`: long-lived domain integration branches.
- `ai/<owner>/<work-item>`: short-lived implementation branches.

Standard lanes:

- `lane/masterai`
- `lane/communications`
- `lane/crm`
- `lane/property`
- `lane/finance`
- `lane/frontend`
- `lane/ops`

## Domain Ownership

- `lane/masterai`: orchestration, workflow engine, policy decisions, contract authority.
- `lane/communications`: inbound channel normalization, adapters, webhook handling.
- `lane/crm`: lead lifecycle, timeline, profile snapshot and merge logic.
- `lane/property`: property/unit lifecycle, occupancy state, maintenance domain.
- `lane/finance`: deterministic finance workflows, authorization-gated mutations, ledger integrity.
- `lane/frontend`: admin/client interfaces and frontend module behavior.
- `lane/ops`: environment policy, auth gates, readiness/health, deployment and runtime controls.

## Naming Rules

- Lane branch: `lane/<domain>`.
- AI branch: `ai/<owner>/<domain>-<short-description>`.

Examples:

- `ai/dev1/property-availability-guard`
- `ai/dev2/masterai-timeout-policy`

## Merge Workflow

1. `ai/*` merges into corresponding `lane/*` after lane checks pass.
2. Cross-domain initiatives use a temporary `integration/<initiative>` branch.
3. Stabilized `lane/*` branches merge into `main` during release windows.

## Guardrails

- Keep changes lane-local by default.
- Cross-lane edits require explicit mention in merge notes.
- Finance behavior changes must stay in `lane/finance`.
- Contract/event schema changes are coordinated by `lane/masterai`.

## Required Merge Evidence

Every AI merge should include:

- change scope
- impacted files
- contract impact (if any)
- invariants touched
- tests executed or reason skipped
- known risks

## Repository Enforcement Controls

The following controls convert process guidance into enforceable behavior:

1. Branch protection on `main`:
- Require pull requests.
- Require status checks to pass before merge.
- Block direct pushes.

2. Branch protection on `lane/*`:
- Require pull requests.
- Require status checks to pass before merge.
- Block direct pushes.

3. Pull request template:
- Use a mandatory checklist for session intent confirmation, plan confirmation, and lane alignment.

4. CI governance workflow:
- Validate source/target branch policy for pull requests.
- Require checklist evidence in PR body.
- Run lane-relevant tests based on changed paths.

## Why This Is Required

This model reduces merge conflicts, protects business invariants, and enables predictable AI parallelization as the product scales to external customers.

## Session Start Protocol (Mandatory)

At the start of every AI development session:

1. Confirm the user's intended outcome before coding.
2. Confirm the target lane/domain and branch strategy.
3. Present a short execution plan and wait for user confirmation.
4. Begin implementation only after the plan is acknowledged.

This protocol is required to avoid scope drift and ensure branch alignment before code changes.
