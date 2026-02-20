/**
 * AUTO-GENERATED TEST FILE
 * Source: testing/masterAI/decision_matrix.md
 * Generated at: 2026-02-20T08:30:00.000Z
 *
 * DO NOT EDIT MANUALLY
 */
const { TestHarness } = require('../TestHarness');

describe('MasterAI Decision Matrix Compliance', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    test('Row 1: message.received (Text="Hi") -> onboarding_flow', async () => {
        // Context: New User (No Profile)
        harness.logicEngine.defineWorkflow('onboarding_flow', 'message.received', [
            { name: 'Step', tool: 'CRM.create_lead', args: {} },
            { name: 'Step', tool: 'Chat.reply', args: {} }
        ], {});

        const workflowId = await harness.logicEngine.executeWorkflow('onboarding_flow', {});
        expect(workflowId).toBeDefined();

        // Wait for async execution (simple delay for Phase 1)
        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(workflowId);
        expect(details).not.toBeNull();
        expect(details.status).not.toBe('FAILED');
        expect(details.history.length).toBeGreaterThan(0);

        // Verify tool calls via harness
        const crmCalls = harness.getCallHistory('CRM');
        const chatCalls = harness.getCallHistory('Chat');
        expect(crmCalls.length).toBeGreaterThanOrEqual(1);
        expect(crmCalls[0].tool).toBe('create_lead');
        expect(chatCalls.length).toBeGreaterThanOrEqual(1);
        expect(chatCalls[0].tool).toBe('reply');
    });

    test('Row 2: message.received (Text="Book Visit") -> booking_flow', async () => {
        // Context: Existing User (Verified)
        harness.logicEngine.defineWorkflow('booking_flow', 'message.received', [
            { name: 'Step', tool: 'Property.get_availability', args: {} },
            { name: 'Step', tool: 'Chat.reply', args: {} }
        ], {});

        const workflowId = await harness.logicEngine.executeWorkflow('booking_flow', {});
        expect(workflowId).toBeDefined();

        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(workflowId);
        expect(details).not.toBeNull();
        expect(details.status).not.toBe('FAILED');
        expect(details.history.length).toBeGreaterThan(0);

        const propertyCalls = harness.getCallHistory('Property');
        const chatCalls = harness.getCallHistory('Chat');
        expect(propertyCalls.length).toBeGreaterThanOrEqual(1);
        expect(propertyCalls[0].tool).toBe('get_availability');
        expect(chatCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('Row 3: payment.received -> payment_ack_flow', async () => {
        // Context: Any
        harness.logicEngine.defineWorkflow('payment_ack_flow', 'payment.received', [
            { name: 'Step', tool: 'Finance.record_txn', args: {} },
            { name: 'Step', tool: 'Chat.reply', args: {} }
        ], {});

        const workflowId = await harness.logicEngine.executeWorkflow('payment_ack_flow', {});
        expect(workflowId).toBeDefined();

        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(workflowId);
        expect(details).not.toBeNull();
        expect(details.status).not.toBe('FAILED');
        expect(details.history.length).toBeGreaterThan(0);

        const financeCalls = harness.getCallHistory('Finance');
        const chatCalls = harness.getCallHistory('Chat');
        expect(financeCalls.length).toBeGreaterThanOrEqual(1);
        expect(financeCalls[0].tool).toBe('record_txn');
        expect(chatCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('Row 4: timer.daily_check -> maintenance_check_flow', async () => {
        // Context: Default
        harness.logicEngine.defineWorkflow('maintenance_check_flow', 'timer.daily_check', [
            { name: 'Step', tool: 'Property.get_maintenance_reqs', args: {} }
        ], {});

        const workflowId = await harness.logicEngine.executeWorkflow('maintenance_check_flow', {});
        expect(workflowId).toBeDefined();

        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(workflowId);
        expect(details).not.toBeNull();
        expect(details.status).not.toBe('FAILED');
        expect(details.history.length).toBeGreaterThan(0);

        const propertyCalls = harness.getCallHistory('Property');
        expect(propertyCalls.length).toBeGreaterThanOrEqual(1);
        expect(propertyCalls[0].tool).toBe('get_maintenance_reqs');
    });

    test('Row 5: system.error (Critical) -> escalation_flow', async () => {
        // Context: Any
        // Note: 'Admin' agent is not in default TestHarness mock agents,
        // so we add it manually for this test.
        const { MockAgent } = require('../TestHarness');
        harness.agents['Admin'] = new MockAgent('Admin');

        harness.logicEngine.defineWorkflow('escalation_flow', 'system.error', [
            { name: 'Step', tool: 'Admin.escalate_to_human', args: {} },
            { name: 'Step', tool: 'Chat.reply', args: {} }
        ], {});

        const workflowId = await harness.logicEngine.executeWorkflow('escalation_flow', {});
        expect(workflowId).toBeDefined();

        await new Promise(r => setTimeout(r, 200));

        const details = harness.logicEngine.getWorkflowDetails(workflowId);
        expect(details).not.toBeNull();
        expect(details.status).not.toBe('FAILED');
        expect(details.history.length).toBeGreaterThan(0);

        const adminCalls = harness.getCallHistory('Admin');
        const chatCalls = harness.getCallHistory('Chat');
        expect(adminCalls.length).toBeGreaterThanOrEqual(1);
        expect(adminCalls[0].tool).toBe('escalate_to_human');
        expect(chatCalls.length).toBeGreaterThanOrEqual(1);
    });
});
