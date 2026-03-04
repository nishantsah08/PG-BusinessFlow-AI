# MasterAI Scenario Library

## 1. Happy Path Scenarios
*   **SCN-001: Successful End-to-End Booking**
    *   User asks for room -> MasterAI checks availability -> User confirms -> MasterAI books -> Payment received -> Booking confirmed.

    **Expected Integration Result**
    *   **Agents Called:** CRM (lead lookup/create) → Property (get_availability, assign_tenant) → Finance (record_txn) → Communications (send confirmation)
    *   **Final System State:** Workflow = `COMPLETED`; Unit status = `BOOKED`; CRM lead status = `Onboarded`; Ledger entry created (Security Deposit + Rent); Session appended to CRM timeline
    *   **User Visible Output:** Kalyani confirms booking with unit details, move-in date, and payment receipt summary
    *   **Logs Generated:** `message.received` event → `booking_flow` workflow start → `Property.get_availability` tool call → `Property.assign_tenant` tool call → `Finance.record_txn` tool call → `Communications.send_message` tool call → workflow `COMPLETED`
    *   **Failure Handling:** N/A (happy path)

*   **SCN-002: Maintenance Request via Chat**
    *   Tenant reports leak -> MasterAI logs ticket -> MasterAI confirms proactively.

    **Expected Integration Result**
    *   **Agents Called:** CRM (session lookup) → Property (log_maintenance_req) → Communications (send acknowledgement)
    *   **Final System State:** Workflow = `COMPLETED`; Maintenance ticket created with status `OPEN`; CRM session appended with `maintenance_request` tag
    *   **User Visible Output:** Kalyani acknowledges the issue, provides ticket reference, and confirms follow-up timeline
    *   **Logs Generated:** `message.received` event → `maintenance_check_flow` workflow start → `CRM.get_lead` tool call → `Property.log_maintenance_req` tool call → `Communications.send_message` tool call → workflow `COMPLETED`
    *   **Failure Handling:** N/A (happy path)

## 2. Failure & Resilience Scenarios
*   **SCN-ERR-001: Payment Gateway Timeout**
    *   User pays -> Webhook delayed > 60s -> MasterAI queries status -> Finds success -> Reconciles manually.

    **Expected Integration Result**
    *   **Agents Called:** Finance (record_txn — timeout) → Finance (query_txn_status — retry) → Finance (record_txn — reconcile) → Communications (send confirmation)
    *   **Final System State:** Workflow = `COMPLETED`; Transaction recorded with reconciliation flag; Ledger entry correctly allocated via waterfall
    *   **User Visible Output:** Kalyani informs user of brief delay, then confirms payment received
    *   **Logs Generated:** `payment.received` event → `payment_ack_flow` start → `Finance.record_txn` TIMEOUT (>60s, invariant §4) → retry initiated → `Finance.query_txn_status` SUCCESS → manual reconciliation → workflow `COMPLETED`
    *   **Failure Handling:** Timeout enforced per invariant §4 (60s). Retry with status query. If all retries fail → escalation_flow triggered.

*   **SCN-ERR-002: Agent Crash During Flow**
    *   Booking Flow Step 2 (Property Check) succeeds -> Step 3 (Payment Link) fails (Agent Crash) -> MasterAI retries 3x -> MasterAI informs user of technical difficulty.

    **Expected Integration Result**
    *   **Agents Called:** CRM (lead lookup) → Property (get_availability — success) → Finance (generate_payment_link — crash × 3) → Communications (send error message)
    *   **Final System State:** Workflow = `FAILED`; No unit assigned (no partial state); CRM session logged with error context
    *   **User Visible Output:** Kalyani apologizes for technical difficulty, does NOT expose internal error details (invariant §5: Persona Integrity)
    *   **Logs Generated:** `booking_flow` start → `Property.get_availability` SUCCESS → `Finance.generate_payment_link` CRASH → retry 1 CRASH → retry 2 CRASH → retry 3 CRASH → error containment (invariant §4) → `Communications.send_message` → workflow `FAILED`
    *   **Failure Handling:** 3 retries exhausted. Error contained per invariant §4 (Error Containment). No crash propagation to LogicEngine. User informed via persona-safe message.

*   **SCN-ERR-003: Rollback on Critical Failure**
    *   Tenant Onboarding: Lease Signed (Success) -> Payment Failed (Fail) -> MasterAI Voids Lease (Compensation).

    **Expected Integration Result**
    *   **Agents Called:** Property (assign_tenant — success) → Finance (record_txn — fail) → Property (vacate_tenant — compensation) → Communications (send failure notice)
    *   **Final System State:** Workflow = `ROLLED_BACK`; Unit status reverted to `AVAILABLE`; No ledger entry; Compensation history recorded with reverse-order steps; CRM session logged
    *   **User Visible Output:** Kalyani informs user that onboarding could not be completed due to payment failure, asks to retry
    *   **Logs Generated:** `onboarding_flow` start → `Property.assign_tenant` SUCCESS → `Finance.record_txn` FAIL → compensation triggered → `Property.vacate_tenant` (undo) SUCCESS → workflow `ROLLED_BACK`
    *   **Failure Handling:** Compensation executed in reverse order per invariant §1 (Atomic Transactions) and §6 (Workflow Rollback Integrity). Final status = `ROLLED_BACK`, never `PARTIAL_SUCCESS`.

## 3. Edge Cases
*   **SCN-EDGE-001: Duplicate Webhook**
    *   Payment `evt_123` received -> Processed.
    *   Payment `evt_123` received AGAIN -> MasterAI detects duplicate -> Ignores, returns Idempotency Key.

    **Expected Integration Result**
    *   **Agents Called:** First event: Finance (record_txn) → Communications (send confirmation). Second event: NONE (zero agent calls)
    *   **Final System State:** Single transaction recorded; Single ledger entry; State snapshot identical before and after duplicate event
    *   **User Visible Output:** First event: Kalyani confirms payment. Second event: No user-visible output (silently ignored)
    *   **Logs Generated:** First: `payment.received` → `payment_ack_flow` → `COMPLETED`. Second: `payment.received` (same `event_id`) → engine returns `{ duplicate: true }` → no workflow created
    *   **Failure Handling:** Duplicate detected per invariant §6 (Duplicate Event Idempotency). Zero additional tool calls. State unchanged.

*   **SCN-EDGE-002: Replayed Event Stream**
    *   Replay yesterday's logs -> System state should **not** change (Idempotency check).

    **Expected Integration Result**
    *   **Agents Called:** NONE (all events already processed — every event returns `{ duplicate: true }`)
    *   **Final System State:** Identical to pre-replay snapshot; No new workflows; No new ledger entries; Agent call counts unchanged
    *   **User Visible Output:** NONE (no user-facing messages generated)
    *   **Logs Generated:** Each replayed event → `{ duplicate: true }` logged per event. No workflow transitions. No tool calls.
    *   **Failure Handling:** Full replay idempotency per invariant §6 (Replay Idempotency). If any state change detected → test FAILS.

*   **SCN-EDGE-003: Race Condition**
    *   "Cancel Booking" and "Confirm Payment" events arrive milliseconds apart. System must lock and process sequentially.

    **Expected Integration Result**
    *   **Agents Called:** Depends on lock acquisition order. Winner: full workflow agents. Loser: receives `LOCK_CONFLICT`, no agent calls on contested resource
    *   **Final System State:** Exactly one outcome applies (either cancelled or confirmed, never both); No orphaned locks in `getGlobalState().locks`; Resource state consistent
    *   **User Visible Output:** User receives exactly one definitive response from Kalyani (either cancellation confirmed OR payment confirmed, not both)
    *   **Logs Generated:** Both events received → lock acquisition on resource → first workflow executes → lock released → second workflow attempts → `LOCK_CONFLICT` or sequential execution → final state logged
    *   **Failure Handling:** Lock exclusion per invariant §6 (Locked Resource Exclusion). Sequential processing enforced. No concurrent mutation of same resource.

## 4. Phase-2 Determinism Scenarios

These scenarios validate engine-level resilience guarantees added in Phase-2. All use deterministic clock and parallel execution — no real-time delays.

*   **SCN-P2-001: Duplicate Event Replay**
    *   Payment webhook `EVT-PAY-42` fires -> workflow completes -> same webhook fires again.
    *   Engine returns `{ duplicate: true }` -> no agents called -> state snapshot unchanged.
    *   Validates: `invariants.md §6: Duplicate Event Idempotency`.

    **Expected Integration Result**
    *   **Agents Called:** First fire: Finance (record_txn) → Communications (send_message). Second fire: NONE
    *   **Final System State:** Single workflow instance; Single transaction; Agent call count = 1 per agent (not 2); State snapshot identical before/after second fire
    *   **User Visible Output:** First fire: payment confirmation. Second fire: NONE
    *   **Logs Generated:** First: full workflow trace. Second: `processEvent()` → `{ duplicate: true }` → zero tool calls logged
    *   **Failure Handling:** N/A — idempotency is the expected behavior, not a failure.

*   **SCN-P2-002: Parallel Conflicting Workflows**
    *   Two users attempt to book unit A101 simultaneously via `runParallel()`.
    *   First workflow acquires `lock:unit:A101` -> succeeds -> lock released.
    *   Second workflow receives `LOCK_CONFLICT` -> fails -> no Property agent call.
    *   Validates: `invariants.md §6: Locked Resource Exclusion`.

    **Expected Integration Result**
    *   **Agents Called:** Workflow 1: Property (assign_tenant for A101) → Finance → Communications. Workflow 2: NONE (fails before agent invocation)
    *   **Final System State:** Unit A101 = `BOOKED` (by first user only); Workflow 1 = `COMPLETED`; Workflow 2 = `FAILED` with `LOCK_CONFLICT`; Zero orphaned locks
    *   **User Visible Output:** User 1: booking confirmed. User 2: Kalyani informs unit unavailable
    *   **Logs Generated:** `runParallel()` → Workflow 1 acquires `lock:unit:A101` → executes → releases lock. Workflow 2 attempts lock → `LOCK_CONFLICT` → `FAILED`
    *   **Failure Handling:** Lock exclusion per invariant §6. Second workflow does NOT queue or retry — it fails immediately.

*   **SCN-P2-003: Compensation Recovery**
    *   Tenant onboarding: assign unit (✔) -> create ledger (✔) -> send notification (✖ crash).
    *   Engine runs compensation in reverse: undo ledger -> undo assignment.
    *   Final status: `ROLLED_BACK`. All compensation entries recorded.
    *   Validates: `invariants.md §6: Workflow Rollback Integrity`.

    **Expected Integration Result**
    *   **Agents Called:** Forward: Property (assign_tenant ✔) → Finance (create_ledger ✔) → Communications (send_notification ✖). Compensation: Finance (undo_ledger) → Property (vacate_tenant)
    *   **Final System State:** Workflow = `ROLLED_BACK`; Unit reverted to `AVAILABLE`; Ledger entry removed/voided; Compensation history: 2 entries in reverse order, all `UNDONE`
    *   **User Visible Output:** Kalyani informs user of processing issue, no partial onboarding communicated
    *   **Logs Generated:** Forward steps logged with outcomes → crash at step 3 → compensation triggered → reverse-order undo logged → final status `ROLLED_BACK`
    *   **Failure Handling:** Compensation per invariant §1 (Atomic Transactions) and §6 (Workflow Rollback Integrity). If compensation itself fails → status = `COMPENSATION_FAILED` → escalation.

*   **SCN-P2-004: Expired Workflow Execution Attempt**
    *   Workflow defined with 5-second deadline -> clock advanced 6 seconds via `advanceTime()`.
    *   Engine checks deadline before first step -> fails with `DEADLINE_EXPIRED`.
    *   No agents called. No steps executed.
    *   Validates: `invariants.md §6: Expired Workflow Immutability`.

    **Expected Integration Result**
    *   **Agents Called:** NONE (zero agent invocations)
    *   **Final System State:** Workflow = `FAILED` with error `DEADLINE_EXPIRED`; Zero steps executed; No state mutations; No resource locks acquired
    *   **User Visible Output:** NONE (workflow rejected before any user interaction)
    *   **Logs Generated:** Workflow creation → deadline check → `DEADLINE_EXPIRED` → workflow `FAILED` → zero tool call entries
    *   **Failure Handling:** Deadline enforced per invariant §6 (Expired Workflow Immutability). Stale operations prevented entirely.

## 5. Session Context Scenarios

*   **SCN-SESSION-001: Known User Context Load**
    *   Returning customer messages via WhatsApp → CRM lookup returns profile with 5+ past sessions → session created with last 3 → system prompt includes conversation history.

    **Expected Integration Result**
    *   **Agents Called:** CRM (get_lead_by_phone → Found, get_timeline → 3 SESSION events)
    *   **Final System State:** Session created with `leadContext` populated, `recentSessions.length === 3`, system prompt contains `Recent Conversation History`
    *   **User Visible Output:** Kalyani responds with awareness of past conversations (e.g., references previous booking discussion)
    *   **Failure Handling:** N/A (happy path)

*   **SCN-SESSION-002: Unknown User Deferred Lead**
    *   Unknown number messages → temp lead → conversation about rooms → session timeout → AI classifies as business-relevant → CRM lead created + session logged.

    **Expected Integration Result**
    *   **Agents Called:** CRM (get_lead_by_phone → Not Found) at session start. At flush: LLM classification → CRM (add_lead, log_session)
    *   **Final System State:** No CRM lead during conversation. After flush: lead exists with AI-extracted name + session event with summary/sentiment
    *   **User Visible Output:** Kalyani responds normally during conversation. No user-visible output at flush.
    *   **Failure Handling:** If LLM classification fails, session drops. If CRM write fails, `flush.failed` event emitted (Failure Policy §2.2).

*   **SCN-SESSION-003: Spam Filtered**
    *   Unknown number sends "wrong number" → temp lead → session timeout → AI classifies as not relevant → no CRM write.

    **Expected Integration Result**
    *   **Agents Called:** CRM (get_lead_by_phone → Not Found) at start. At flush: LLM classification only. ZERO CRM write calls.
    *   **Final System State:** No CRM lead created. Session silently deleted.
    *   **User Visible Output:** Kalyani responds to "wrong number" naturally. No follow-up.
    *   **Failure Handling:** N/A — dropping irrelevant sessions is the desired behavior.

*   **SCN-SESSION-F01: CRM Down During Session Init**
    *   Returning customer messages → CRM throws on lookup → session created with empty context → Kalyani responds generically → no crash, zero retries.

    **Expected Integration Result**
    *   **Agents Called:** CRM (get_lead_by_phone → throws). ZERO retry calls.
    *   **Final System State:** Session exists with `leadContext: null`, `recentSessions: []`. No crash.
    *   **User Visible Output:** Kalyani responds generically without personalization (no name, no history)
    *   **Failure Handling:** Fail fast per Failure Policy §2.1. Zero retries. System degrades gracefully.

*   **SCN-SESSION-F02: Flush CRM Failure**
    *   Business-relevant conversation classified → `add_lead` throws → `flush.failed` event emitted → DLQ captures payload for later recovery.

    **Expected Integration Result**
    *   **Agents Called:** LLM classification (success) → CRM (add_lead → throws). ZERO retry calls.
    *   **Final System State:** No CRM lead created. `flush.failed` event emitted with `verdict` + `messages` payload. Session deleted.
    *   **User Visible Output:** NONE (flush happens after session timeout, user is already gone)
    *   **Failure Handling:** Data Plane safety per Failure Policy §2.2. Event payload preserved for DLQ recovery.
