/**
 * Phase 2 — Idempotency Tests
 * Proves: duplicate events never produce duplicate state changes.
 */
const { TestHarness } = require('../TestHarness');

describe('Phase 2: Idempotency', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    test('IDEM-01: Duplicate Event — same event_id executes workflow only once', async () => {
        harness.logicEngine.defineWorkflow('idem_wf', 'payment.received', [
            { name: 'RecordPayment', tool: 'Finance.record_txn', args: { amount: 5000 } },
            { name: 'Confirm', tool: 'Chat.reply', args: { text: 'Payment received' } }
        ], {});

        const eventId = 'EVT-IDEM-001';

        // First submission
        const result1 = harness.logicEngine.processEvent(eventId, 'idem_wf', { user: 'U1' });
        expect(result1.duplicate).toBe(false);

        // Wait for workflow to complete
        await result1.instanceIdPromise;
        await new Promise(r => setTimeout(r, 400));

        // Second submission — same event_id
        const result2 = harness.logicEngine.processEvent(eventId, 'idem_wf', { user: 'U1' });
        expect(result2.duplicate).toBe(true);
        expect(result2.originalWorkflowId).toBeDefined();

        // Finance called exactly once
        expect(harness.getCallHistory('Finance').length).toBe(1);
        expect(harness.getCallHistory('Chat').length).toBe(1);
    });

    test('IDEM-02: Replay Event — no duplicate actions, no duplicate logs', async () => {
        harness.logicEngine.defineWorkflow('replay_wf', 'message.received', [
            { name: 'AddLead', tool: 'CRM.add_lead', args: { name: 'Ali' } }
        ], {});

        const eventId = 'EVT-REPLAY-001';

        // Original processing
        const result1 = harness.logicEngine.processEvent(eventId, 'replay_wf', {});
        await result1.instanceIdPromise;
        await new Promise(r => setTimeout(r, 300));

        // Capture state snapshot after original
        const stateAfterOriginal = harness.getGlobalState();

        // Replay via harness
        const replayResult = harness.replayEvent({
            id: eventId,
            workflowId: 'replay_wf',
            context: {}
        });
        expect(replayResult.duplicate).toBe(true);

        // State must be identical — no new agent calls
        const stateAfterReplay = harness.getGlobalState();

        // Agent call counts unchanged
        expect(stateAfterReplay.agents.CRM.calls.length)
            .toBe(stateAfterOriginal.agents.CRM.calls.length);

        // No extra workflows created
        expect(Object.keys(stateAfterReplay.activeWorkflows).length)
            .toBe(Object.keys(stateAfterOriginal.activeWorkflows).length);
    });

    test('IDEM-03: Delayed Arrival — E2 before E1, both process, correct final state', async () => {
        harness.logicEngine.defineWorkflow('order_wf', 'message.received', [
            { name: 'ProcessMsg', tool: 'Chat.reply', args: {} }
        ], {});

        const eventId1 = 'EVT-ORDER-E1';
        const eventId2 = 'EVT-ORDER-E2';

        // E2 arrives first
        const r2 = harness.logicEngine.processEvent(eventId2, 'order_wf', { seq: 2 });
        expect(r2.duplicate).toBe(false);

        // E1 arrives second
        const r1 = harness.logicEngine.processEvent(eventId1, 'order_wf', { seq: 1 });
        expect(r1.duplicate).toBe(false);

        // Wait for both
        await r2.instanceIdPromise;
        await r1.instanceIdPromise;
        await new Promise(r => setTimeout(r, 400));

        // Both processed independently (different event IDs)
        expect(harness.getCallHistory('Chat').length).toBe(2);

        // Both workflows completed
        const state = harness.getGlobalState();
        const workflows = Object.values(state.activeWorkflows);
        expect(workflows.filter(w => w.status === 'COMPLETED').length).toBe(2);
    });

    test('IDEM-04: Duplicate Payment Event — ledger updated exactly once', async () => {
        harness.logicEngine.defineWorkflow('pay_wf', 'payment.received', [
            { name: 'RecordLedger', tool: 'Finance.record_txn', args: { amount: 10000 } },
            { name: 'AssignUnit', tool: 'Property.assign_unit', args: {} },
            { name: 'Notify', tool: 'Chat.reply', args: {} }
        ], {});

        const paymentEventId = 'EVT-PAY-WEBHOOK-42';

        // Webhook fires
        const r1 = harness.logicEngine.processEvent(paymentEventId, 'pay_wf', { txn: 'TXN-42' });
        await r1.instanceIdPromise;
        await new Promise(r => setTimeout(r, 500));

        // Webhook fires again (duplicate from gateway)
        const r2 = harness.logicEngine.processEvent(paymentEventId, 'pay_wf', { txn: 'TXN-42' });
        expect(r2.duplicate).toBe(true);

        // Ledger updated exactly once
        const financeCalls = harness.getCallHistory('Finance');
        expect(financeCalls.length).toBe(1);
        expect(financeCalls[0].args.amount).toBe(10000);

        // Property and Chat also called exactly once
        expect(harness.getCallHistory('Property').length).toBe(1);
        expect(harness.getCallHistory('Chat').length).toBe(1);
    });
});
