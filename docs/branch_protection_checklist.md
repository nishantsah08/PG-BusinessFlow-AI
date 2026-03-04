# Branch Protection Checklist

## Purpose

Apply remote repository settings so the AI branching workflow is enforced, not optional.

## Protected Branches

Configure these as protected:

- `main`
- `lane/*`

## Rules To Enable

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Require branches to be up to date before merging.
4. Restrict who can push (or disable direct pushes).
5. Include administrators in enforcement.
6. Disable force pushes.
7. Disable branch deletion for protected branches.

## Required Status Checks

Mark these checks as required:

- `Branch Governance`
- `Lane CI`

These checks are provided by `.github/workflows/branch_governance_and_lane_ci.yml`.

## Merge Policy

1. `ai/*` branches merge into `lane/*`.
2. `lane/*` branches merge into `main`.
3. Cross-domain changes use `integration/*` before promotion.

## Operational Note

Branch protection is configured in your Git provider settings and cannot be fully enforced from local Git alone.
