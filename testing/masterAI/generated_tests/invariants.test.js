/**
 * MasterAI Invariant Enforcement Tests
 * Source: testing/masterAI/invariants.md
 *
 * These are the "Laws of Physics" — a violation in ANY test
 * is a deployment blocker.
 */
const { TestHarness, MockAgent } = require('../TestHarness');

describe('MasterAI System Invariants', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    // ========================================
    // 1. Workflow Integrity
    // ========================================
    describe('Workflow Integrity', () => {
        test('INV-WF-01: Successful workflow ends in COMPLETED, never partial', async () => {
            harness.logicEngine.defineWorkflow('inv_happy', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} },
                { name: 'Step2', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_happy', {});
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');
            expect(details.history.length).toBe(2);
            // Every step in history must be SUCCESS
            details.history.forEach(entry => {
                expect(entry.status).toBe('SUCCESS');
            });
        });

        test('INV-WF-02: Failed workflow ends in FAILED, not stuck in RUNNING', async () => {
            // Configure CRM to crash on add_lead
            harness.configureMock('CRM', 'add_lead', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('inv_fail', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} },
                { name: 'Step2', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_fail', {});
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('FAILED');
            expect(details.error).toBeDefined();
            // Step2 should NOT have been called
            const chatCalls = harness.getCallHistory('Chat');
            expect(chatCalls.length).toBe(0);
        });

        test('INV-WF-03: No Zombie Flows — RUNNING must transition', async () => {
            harness.logicEngine.defineWorkflow('inv_zombie', 'test.event', [
                { name: 'Step1', tool: 'Finance.record_txn', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_zombie', {});
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            // Must have transitioned OUT of RUNNING
            expect(details.status).not.toBe('RUNNING');
            expect(['COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED']).toContain(details.status);
        });

        test('INV-WF-04: Deterministic Step Order — history matches definition', async () => {
            harness.logicEngine.defineWorkflow('inv_order', 'test.event', [
                { name: 'StepA', tool: 'CRM.add_lead', args: {} },
                { name: 'StepB', tool: 'Property.get_availability', args: {} },
                { name: 'StepC', tool: 'Finance.record_txn', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_order', {});
            await new Promise(r => setTimeout(r, 400));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');
            expect(details.history.length).toBe(3);

            // Verify exact order
            expect(details.history[0].step.tool).toBe('CRM.add_lead');
            expect(details.history[1].step.tool).toBe('Property.get_availability');
            expect(details.history[2].step.tool).toBe('Finance.record_txn');

            // Verify chronological timestamps
            for (let i = 1; i < details.history.length; i++) {
                expect(new Date(details.history[i].timestamp).getTime())
                    .toBeGreaterThanOrEqual(new Date(details.history[i - 1].timestamp).getTime());
            }
        });
    });

    // ========================================
    // 2. Communication Discipline
    // ========================================
    describe('Communication Discipline', () => {
        test('INV-COM-01: Hub-and-Spoke — all calls go through TestHarness interception', async () => {
            harness.logicEngine.defineWorkflow('inv_hub', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: { name: 'Test' } },
                { name: 'Step2', tool: 'Property.get_availability', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_hub', {});
            await new Promise(r => setTimeout(r, 300));

            // Every tool call must have been intercepted by our MockAgents
            const crmCalls = harness.getCallHistory('CRM');
            const propCalls = harness.getCallHistory('Property');
            expect(crmCalls.length).toBe(1);
            expect(propCalls.length).toBe(1);
            // The LogicEngine never called agents directly — it went through mockExecuteStep
            expect(crmCalls[0].tool).toBe('add_lead');
            expect(propCalls[0].tool).toBe('get_availability');
        });

        test('INV-COM-02: Event Causality — every history entry references originating step', async () => {
            harness.logicEngine.defineWorkflow('inv_causal', 'test.event', [
                { name: 'CheckAvailability', tool: 'Property.get_availability', args: {} },
                { name: 'NotifyUser', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_causal', {});
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            details.history.forEach(entry => {
                // Each history entry must reference the step that caused it
                expect(entry.step).toBeDefined();
                expect(entry.step.name).toBeDefined();
                expect(entry.step.tool).toBeDefined();
            });
        });
    });

    // ========================================
    // 3. Operational Boundaries
    // ========================================
    describe('Operational Boundaries', () => {
        test('INV-OPS-01: Error Containment — agent crash does not crash LogicEngine', async () => {
            harness.configureMock('Finance', 'record_txn', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('inv_contain', 'test.event', [
                { name: 'Step1', tool: 'Finance.record_txn', args: {} }
            ], {});

            // This must NOT throw — the engine must catch the error
            const wfId = await harness.logicEngine.executeWorkflow('inv_contain', {});
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('FAILED');
            expect(details.error).toContain('Crash Sim');

            // Engine is still alive — can define and run another workflow
            harness.logicEngine.defineWorkflow('inv_after', 'test.event', [
                { name: 'Step1', tool: 'Chat.reply', args: {} }
            ], {});
            const wfId2 = await harness.logicEngine.executeWorkflow('inv_after', {});
            await new Promise(r => setTimeout(r, 200));

            const details2 = harness.logicEngine.getWorkflowDetails(wfId2);
            expect(details2.status).toBe('COMPLETED');
        });

        test('INV-OPS-02: Unknown agent does not crash engine', async () => {
            harness.logicEngine.defineWorkflow('inv_unknown', 'test.event', [
                { name: 'Step1', tool: 'NonExistentAgent.do_thing', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_unknown', {});
            await new Promise(r => setTimeout(r, 300));

            // Should complete (mockExecuteStep returns { error: 'Unknown Agent' } not throw)
            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details).not.toBeNull();
            // Should not be stuck in RUNNING
            expect(details.status).not.toBe('RUNNING');
        });
    });

    // ========================================
    // 4. Data Consistency
    // ========================================
    describe('Data Consistency', () => {
        test('INV-DATA-01: Append-Only History — history grows, never shrinks', async () => {
            harness.logicEngine.defineWorkflow('inv_append', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} },
                { name: 'Step2', tool: 'Chat.reply', args: {} },
                { name: 'Step3', tool: 'Finance.record_txn', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('inv_append', {});

            // Snapshot history length at intervals
            const lengths = [];
            for (let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 100));
                const d = harness.logicEngine.getWorkflowDetails(wfId);
                if (d) lengths.push(d.history.length);
            }

            // History length must be monotonically non-decreasing
            for (let i = 1; i < lengths.length; i++) {
                expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
            }
        });
    });
});
