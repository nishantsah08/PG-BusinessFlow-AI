/**
 * MasterAI Contract Simulation Tests
 * Source: testing/masterAI/contract_sim_plan.md
 *
 * Tests all 5 MockAgent behavior modes to verify LogicEngine
 * handles each contract outcome correctly.
 */
const { TestHarness, MockAgent } = require('../TestHarness');

describe('MasterAI Contract Simulation', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    // ========================================
    // Mode: SUCCESS
    // ========================================
    test('CONTRACT-01: SUCCESS mode — valid JSON response, workflow completes', async () => {
        harness.configureMock('CRM', 'add_lead', {
            mode: 'SUCCESS',
            response: { lead_id: 'L-001', status: 'created' }
        });

        harness.logicEngine.defineWorkflow('contract_success', 'test.event', [
            { name: 'AddLead', tool: 'CRM.add_lead', args: { name: 'Test User' } }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('contract_success', {});
        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('COMPLETED');
        expect(details.history[0].status).toBe('SUCCESS');

        // Verify the mock was called with correct args
        const calls = harness.getCallHistory('CRM');
        expect(calls[0].tool).toBe('add_lead');
        expect(calls[0].args).toEqual({ name: 'Test User' });
    });

    // ========================================
    // Mode: EXCEPTION
    // ========================================
    test('CONTRACT-02: EXCEPTION mode — agent throws, workflow fails gracefully', async () => {
        harness.configureMock('Finance', 'record_txn', { mode: 'EXCEPTION' });

        harness.logicEngine.defineWorkflow('contract_exception', 'test.event', [
            { name: 'RecordTxn', tool: 'Finance.record_txn', args: {} }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('contract_exception', {});
        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('FAILED');
        expect(details.error).toContain('Crash Sim');
        // LogicEngine is still alive
        expect(harness.logicEngine).toBeDefined();
    });

    // ========================================
    // Mode: TIMEOUT
    // ========================================
    test('CONTRACT-03: TIMEOUT mode — agent times out, workflow fails', async () => {
        harness.configureMock('Property', 'get_availability', { mode: 'TIMEOUT' });

        harness.logicEngine.defineWorkflow('contract_timeout', 'test.event', [
            { name: 'CheckAvail', tool: 'Property.get_availability', args: {} }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('contract_timeout', {});
        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('FAILED');
        expect(details.error).toContain('Timeout Sim');
    });

    // ========================================
    // Mode: INVALID_PAYLOAD
    // ========================================
    test('CONTRACT-04: INVALID_PAYLOAD mode — garbage response, workflow still completes step', async () => {
        // Note: Current LogicEngine doesn't validate step return values,
        // so INVALID_PAYLOAD doesn't throw — it returns garbage.
        // The workflow continues because no error is thrown.
        harness.configureMock('HR', 'get_payroll', { mode: 'INVALID_PAYLOAD' });

        harness.logicEngine.defineWorkflow('contract_invalid', 'test.event', [
            { name: 'GetPayroll', tool: 'HR.get_payroll', args: {} }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('contract_invalid', {});
        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        // Workflow completes because no exception was thrown
        expect(details.status).toBe('COMPLETED');
        // The mock was still called
        const hrCalls = harness.getCallHistory('HR');
        expect(hrCalls.length).toBe(1);
    });

    // ========================================
    // Mode: SLOW_RESPONSE (with delay)
    // ========================================
    test('CONTRACT-05: SLOW_RESPONSE — delayed but valid response, workflow still completes', async () => {
        harness.configureMock('CRM', 'add_lead', {
            mode: 'SUCCESS',
            delay: 150, // 150ms delay
            response: { lead_id: 'L-002' }
        });

        harness.logicEngine.defineWorkflow('contract_slow', 'test.event', [
            { name: 'AddLead', tool: 'CRM.add_lead', args: {} },
            { name: 'Notify', tool: 'Chat.reply', args: {} }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('contract_slow', {});
        await new Promise(r => setTimeout(r, 500));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('COMPLETED');
        expect(details.history.length).toBe(2);
    });

    // ========================================
    // Mixed Modes in a Single Workflow
    // ========================================
    test('CONTRACT-06: Mixed modes — success then crash stops at failure point', async () => {
        harness.configureMock('CRM', 'add_lead', {
            mode: 'SUCCESS',
            response: { lead_id: 'L-003' }
        });
        harness.configureMock('Finance', 'record_txn', { mode: 'EXCEPTION' });

        harness.logicEngine.defineWorkflow('contract_mixed', 'test.event', [
            { name: 'Step1', tool: 'CRM.add_lead', args: {} },
            { name: 'Step2', tool: 'Finance.record_txn', args: {} },
            { name: 'Step3', tool: 'Chat.reply', args: {} }
        ], {});

        const wfId = await harness.logicEngine.executeWorkflow('contract_mixed', {});
        await new Promise(r => setTimeout(r, 300));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('FAILED');
        // Only Step1 succeeded
        expect(details.history.length).toBe(1);
        expect(details.history[0].step.tool).toBe('CRM.add_lead');
        // Chat was never called
        expect(harness.getCallHistory('Chat').length).toBe(0);
    });

    // ========================================
    // Dynamic Mock Injection
    // ========================================
    test('CONTRACT-07: Dynamic injection — reconfigure mock mid-test', async () => {
        // First workflow: CRM succeeds
        harness.configureMock('CRM', 'add_lead', { mode: 'SUCCESS' });

        harness.logicEngine.defineWorkflow('inject_1', 'test.event', [
            { name: 'Step1', tool: 'CRM.add_lead', args: {} }
        ], {});

        const wfId1 = await harness.logicEngine.executeWorkflow('inject_1', {});
        await new Promise(r => setTimeout(r, 200));
        expect(harness.logicEngine.getWorkflowDetails(wfId1).status).toBe('COMPLETED');

        // Reconfigure CRM to crash
        harness.configureMock('CRM', 'add_lead', { mode: 'EXCEPTION' });

        harness.logicEngine.defineWorkflow('inject_2', 'test.event', [
            { name: 'Step1', tool: 'CRM.add_lead', args: {} }
        ], {});

        const wfId2 = await harness.logicEngine.executeWorkflow('inject_2', {});
        await new Promise(r => setTimeout(r, 200));
        expect(harness.logicEngine.getWorkflowDetails(wfId2).status).toBe('FAILED');
    });
});
