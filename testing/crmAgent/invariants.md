# CRM Agent Invariants

## Identity & Uniqueness
1.  **Phone is Identity**: `lead_id` MUST ALWAYS equal `phones.primary.number`.
2.  **Global Uniqueness**: A phone number (primary or secondary) MUST NOT exist in more than one active lead record.
3.  **Primary Immutable (Logic)**: Changing a primary number is a destructive identity change; it requires a specific migration event (Simulated via `set_primary_phone` which handles ID migration or rejects).
4.  **Merge Integrity**: When Lead A merges into Lead B, Lead A must cease to exist as an independent entity, and all its contact numbers must reside in Lead B.

## Timeline Integrity (Append-Only)
5.  **Immutability**: Once an event is appended to `timeline`, it MUST NEVER be modified or deleted.
6.  **Chronological Order**: Events must be stored in increasing order of `timestamp`.
7.  **Structure**: Every timeline event MUST have `event_id`, `timestamp`, and `type`.
8.  **Session Validity**: A `SESSION` event must always contain a `summary` and `participants`.

## Lifecycle State Machine
9.  **Strict Transitions**: The only valid status changes are:
    *   `(New)` → `Enquiry`
    *   `Enquiry` → `Visited`
    *   `Visited` → `Onboarded`
    *   `Onboarded` → `Left`
    *   `Left` → `Enquiry` (Re-loop)
10. **Synchronization**: The `lead.status` field must ALWAYS match the `to` field of the latest `STATUS_CHANGE` event in the timeline.

## Data Consistency
11. **Snapshot**: `ai_notes` is an append-merge structure; existing keys must not be lost unless explicitly overwritten.
12. **Artifacts**: Artifacts are never deleted, only linked. Multiple artifacts can exist for one session.

## System Contract
13. **MasterAI Payload**: Incoming interactions must contain valid `participants` and `interaction_type`.
14. **Time**: All timestamps must be ISO 8601 strings in IST (simulated).
