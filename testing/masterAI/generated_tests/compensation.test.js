/**
 * Phase 2 — Compensation Logic Tests
 * Proves: failed workflows fully roll back completed steps.
 * Atomicity rule: fully complete OR fully rolled back.
 */
const { TestHarness } = require('../TestHarness');

describe('Phase 2: Compensation Logic', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    test('COMP-01: Mid-Workflow Failure — steps 1-2 succeed, step 3 fails, all undone', async () => {
        // Step 3 will crash
        harness.configureMock('Chat', 'send_notification', { mode: 'EXCEPTION' });

        harness.logicEngine.defineWorkflow('comp_mid_fail', 'tenant.onboard', [
            {
                name: 'AssignTenant',
                tool: 'Property.assign_unit',
                args: { unit: 'B202' },
                compensation: { name: 'UndoAssign', tool: 'Property.vacate_unit', args: { unit: 'B202' } }
            },
            {
                name: 'CreateLedger',
                tool: 'Finance.record_txn',
                args: { type: 'deposit' },
                compensation: { name: 'UndoLedger', tool: 'Finance.reverse_txn', args: { type: 'deposit' } }
            },
            {
                name: 'SendNotification',
                tool: 'Chat.send_notification',
                args: { text: 'Welcome!' }
                // No compensation for this step — it failed, no undo needed
            }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('comp_mid_fail', {});
        await new Promise(r => setTimeout(r, 600));

        const details = harness.logicEngine.getWorkflowDetails(wfId);

        // Workflow must be ROLLED_BACK, not just FAILED
        expect(details.status).toBe('ROLLED_BACK');

        // Two successful steps were recorded before failure
        expect(details.history.length).toBe(2);
        expect(details.history[0].step.tool).toBe('Property.assign_unit');
        expect(details.history[1].step.tool).toBe('Finance.record_txn');

        // Compensation history exists (reverse order: Finance undo first, then Property undo)
        expect(details.compensationHistory).toBeDefined();
        expect(details.compensationHistory.length).toBe(2);
        expect(details.compensationHistory[0].originalStep).toBe('CreateLedger');
        expect(details.compensationHistory[0].status).toBe('UNDONE');
        expect(details.compensationHistory[1].originalStep).toBe('AssignTenant');
        expect(details.compensationHistory[1].status).toBe('UNDONE');

        // Both undo agents were called
        const financeCalls = harness.getCallHistory('Finance');
        const propertyCalls = harness.getCallHistory('Property');
        // Finance: 1 original + 1 undo = 2
        expect(financeCalls.length).toBe(2);
        expect(financeCalls[1].tool).toBe('reverse_txn');
        // Property: 1 original + 1 undo = 2
        expect(propertyCalls.length).toBe(2);
        expect(propertyCalls[1].tool).toBe('vacate_unit');
    });

    test('COMP-02: Partial Success Rollback — step 4 fails, steps 1-3 undone', async () => {
        // Step 4 crashes
        harness.configureMock('Chat', 'send_welcome', { mode: 'EXCEPTION' });

        harness.logicEngine.defineWorkflow('comp_partial', 'tenant.onboard', [
            {
                name: 'VerifyIdentity',
                tool: 'CRM.verify_identity',
                args: {},
                compensation: { name: 'UndoVerify', tool: 'CRM.reset_identity', args: {} }
            },
            {
                name: 'AssignUnit',
                tool: 'Property.assign_unit',
                args: { unit: 'C303' },
                compensation: { name: 'UndoAssign', tool: 'Property.vacate_unit', args: { unit: 'C303' } }
            },
            {
                name: 'CreateLedgerEntry',
                tool: 'Finance.record_txn',
                args: { type: 'security_deposit' },
                compensation: { name: 'UndoLedger', tool: 'Finance.reverse_txn', args: {} }
            },
            {
                name: 'SendWelcome',
                tool: 'Chat.send_welcome',
                args: { text: 'Welcome!' }
                // Fails — no compensation needed for the failing step itself
            }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('comp_partial', {});
        await new Promise(r => setTimeout(r, 800));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('ROLLED_BACK');

        // 3 steps succeeded before failure
        expect(details.history.length).toBe(3);

        // 3 compensation steps executed in reverse
        expect(details.compensationHistory.length).toBe(3);
        expect(details.compensationHistory[0].originalStep).toBe('CreateLedgerEntry');
        expect(details.compensationHistory[1].originalStep).toBe('AssignUnit');
        expect(details.compensationHistory[2].originalStep).toBe('VerifyIdentity');

        // All undone successfully
        details.compensationHistory.forEach(ch => {
            expect(ch.status).toBe('UNDONE');
        });
    });

    test('COMP-03: Compensation Failure — undo itself fails, escalates to human', async () => {
        // Step 2 will crash
        harness.configureMock('Chat', 'send_welcome', { mode: 'EXCEPTION' });
        // And the compensation for step 1 will ALSO crash
        harness.configureMock('Property', 'vacate_unit', { mode: 'EXCEPTION' });

        // Capture escalation events
        const escalations = [];
        harness.eventBus.subscribe('system.escalation', (event) => {
            escalations.push(event);
        });

        harness.logicEngine.defineWorkflow('comp_fail', 'tenant.onboard', [
            {
                name: 'AssignTenant',
                tool: 'Property.assign_unit',
                args: { unit: 'D404' },
                compensation: { name: 'UndoAssign', tool: 'Property.vacate_unit', args: { unit: 'D404' } }
            },
            {
                name: 'SendWelcome',
                tool: 'Chat.send_welcome',
                args: {}
            }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('comp_fail', {});
        await new Promise(r => setTimeout(r, 600));

        const details = harness.logicEngine.getWorkflowDetails(wfId);

        // Status must be COMPENSATION_FAILED — the worst state
        expect(details.status).toBe('COMPENSATION_FAILED');

        // Compensation was attempted but failed
        expect(details.compensationHistory).toBeDefined();
        expect(details.compensationHistory.length).toBe(1);
        expect(details.compensationHistory[0].status).toBe('UNDO_FAILED');

        // Escalation event was emitted
        expect(escalations.length).toBe(1);
        expect(escalations[0].payload.reason).toBe('COMPENSATION_FAILED');
        expect(escalations[0].payload.failedStep).toBe('AssignTenant');
    });
});
