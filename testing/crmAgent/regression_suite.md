# CRM Regression Suite

> **Status**: ACTIVE
> **Last Run**: N/A

## Critical Regression Locks
These tests protect the core business value. Failures here block deployment.

1.  **Uniqueness Lock**: Attempting to create a lead with an existing primary phone MUST fail `Conflict`.
    *   *Test*: `identity.test.js` -> "Duplicate Primary Phone"
2.  **Lifecycle Lock**: Transition `Enquiry` -> `Onboarded` (Skip Visit) MUST fail.
    *   *Test*: `lifecycle.test.js` -> "Invalid Transition"
3.  **Timeline Lock**: Manually modifying `lead.history` array MUST be detected or prevented (in memory implementation relies on API discipline, but test checks API surface).
    *   *Test*: `append_only.test.js` -> "No Update Endpoint available for Timeline"
4.  **Merge Data Loss Lock**: Merging A -> B must result in A's timeline events appearing in B.
    *   *Test*: `merge_logic.test.js` -> "Timeline Preservation"
5.  **Email Lookup Lock**: `get_lead_by_email` must find a lead whose email matches (case-insensitive).
    *   *Test*: `email_lookup.test.js` -> "Case-Insensitive Match"
