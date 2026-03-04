# CRMConsole Design Decisions

## 1. Lead 360 single-route model
- Why built this way: Keeps snapshot and timeline in one operational context for faster decisions.
- Alternative considered: Separate profile and history routes.
- Why rejected: Increased navigation overhead and weaker operator continuity.

## 2. Admin Adapter execution only
- Why built this way: Enforces MasterAI policy gate and central auditability.
- Alternative considered: Direct CRMAgent API route.
- Why rejected: Bypasses centralized policy and role enforcement.

## 3. Authoritative permission gating
- Why built this way: UI capability locks use backend `/api/auth/context` permissions.
- Alternative considered: Local storage role hints.
- Why rejected: Non-authoritative and user-tamperable.
