/**
 * Phase 2 — Race Condition Tests
 * Proves: concurrent workflows cannot corrupt shared state.
 * All concurrency is via runParallel() — deterministic, no random timers.
 */
const { TestHarness } = require('../TestHarness');

describe('Phase 2: Race Conditions', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    test('RACE-01: Double Booking — only one workflow acquires lock', async () => {
        harness.logicEngine.defineWorkflow('book_unit', 'booking.request', [
            {
                name: 'BookUnit',
                tool: 'Property.assign_unit',
                args: { unit: 'A101' },
                locks: ['unit:A101'] // Requires lock on unit A101
            },
            { name: 'Confirm', tool: 'Chat.reply', args: { text: 'Booked!' } }
        ], {});

        // Two users try to book same unit simultaneously
        const instanceIds = await harness.runParallel([
            { workflowId: 'book_unit', context: { user: 'Alice' } },
            { workflowId: 'book_unit', context: { user: 'Bob' } }
        ]);

        await new Promise(r => setTimeout(r, 500));

        // Get results
        const results = instanceIds.map(id => harness.logicEngine.getWorkflowDetails(id));
        const completed = results.filter(r => r.status === 'COMPLETED');
        const failed = results.filter(r => r.status === 'FAILED');

        // Exactly one succeeds, exactly one fails
        expect(completed.length).toBe(1);
        expect(failed.length).toBe(1);

        // Failed one has LOCK_CONFLICT error
        expect(failed[0].error).toContain('LOCK_CONFLICT');
        expect(failed[0].error).toContain('unit:A101');

        // Property called only once (by the winner)
        expect(harness.getCallHistory('Property').length).toBe(1);
    });

    test('RACE-02: Concurrent Status Updates — only valid transitions persist', async () => {
        // Two workflows updating same lead, with locked resource
        harness.logicEngine.defineWorkflow('update_status_active', 'crm.update', [
            {
                name: 'SetActive',
                tool: 'CRM.update_status',
                args: { lead_id: 'L-100', status: 'ACTIVE' },
                locks: ['lead:L-100']
            }
        ], {});

        harness.logicEngine.defineWorkflow('update_status_tenant', 'crm.update', [
            {
                name: 'SetTenant',
                tool: 'CRM.update_status',
                args: { lead_id: 'L-100', status: 'TENANT' },
                locks: ['lead:L-100']
            }
        ], {});

        const instanceIds = await harness.runParallel([
            { workflowId: 'update_status_active', context: { lead: 'L-100' } },
            { workflowId: 'update_status_tenant', context: { lead: 'L-100' } }
        ]);

        await new Promise(r => setTimeout(r, 400));

        const results = instanceIds.map(id => harness.logicEngine.getWorkflowDetails(id));
        const completed = results.filter(r => r.status === 'COMPLETED');
        const failed = results.filter(r => r.status === 'FAILED');

        // Exactly one wins the lock
        expect(completed.length).toBe(1);
        expect(failed.length).toBe(1);

        // CRM called exactly once (the winner)
        const crmCalls = harness.getCallHistory('CRM');
        expect(crmCalls.length).toBe(1);
        // The status is one of the two valid values
        expect(['ACTIVE', 'TENANT']).toContain(crmCalls[0].args.status);
    });

    test('RACE-03: Parallel Payment + Refund — final balance consistent', async () => {
        // Payment workflow locks the account
        harness.logicEngine.defineWorkflow('process_payment', 'payment.received', [
            {
                name: 'RecordPayment',
                tool: 'Finance.record_txn',
                args: { type: 'credit', amount: 5000 },
                locks: ['account:ACC-001']
            },
            { name: 'Confirm', tool: 'Chat.reply', args: { text: 'Payment recorded' } }
        ], {});

        harness.logicEngine.defineWorkflow('process_refund', 'payment.refund', [
            {
                name: 'RecordRefund',
                tool: 'Finance.record_txn',
                args: { type: 'debit', amount: 5000 },
                locks: ['account:ACC-001']
            },
            { name: 'NotifyRefund', tool: 'Chat.reply', args: { text: 'Refund processed' } }
        ], {});

        const instanceIds = await harness.runParallel([
            { workflowId: 'process_payment', context: { account: 'ACC-001' } },
            { workflowId: 'process_refund', context: { account: 'ACC-001' } }
        ]);

        await new Promise(r => setTimeout(r, 500));

        const results = instanceIds.map(id => harness.logicEngine.getWorkflowDetails(id));
        const completed = results.filter(r => r.status === 'COMPLETED');
        const failed = results.filter(r => r.status === 'FAILED');

        // One succeeds, one gets locked out
        expect(completed.length).toBe(1);
        expect(failed.length).toBe(1);

        // Finance called exactly once — no double-counting
        const financeCalls = harness.getCallHistory('Finance');
        expect(financeCalls.length).toBe(1);

        // Lock is now released (winner finished)
        expect(harness.logicEngine.locks['account:ACC-001']).toBeUndefined();

        // State is consistent — no orphaned locks
        const state = harness.getGlobalState();
        expect(Object.keys(state.locks).length).toBe(0);
    });
});
