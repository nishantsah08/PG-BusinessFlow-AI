# Parallel Multi-Actor E2E Scenario Test Plan

## Objective

Validate end-to-end business flow under concurrent users with strict financial determinism and CEO authorization control.

## Core Actors

- `MasterAI (Kalyani)`: Sales and orchestration owner.
- `Caretaker`: Ground operations and visit execution (audio-first WhatsApp communication).
- `CEO`: Final financial authority.
- `Tenant`: External customer lifecycle participant.

## Required Scenarios

1. Parallel finance requests initiated by Sales (MasterAI).
2. CEO-only approval gate before financial workflow execution.
3. Non-CEO approval attempt is rejected.
4. Parallel conversation normalization through CommunicationAI.
5. Caretaker audio-first visit scheduling messaging.
6. House rules document distribution and acknowledgment path.
7. Concurrent multi-tenant isolation (no cross-thread leakage).

## Success Gates

1. All finance mutations return `PENDING_CEO_AUTHORIZATION` when unapproved.
2. CEO approval executes mapped deterministic workflow IDs.
3. Communication templates are validated against local approved inventory.
4. Parallel requests complete without state contamination.
