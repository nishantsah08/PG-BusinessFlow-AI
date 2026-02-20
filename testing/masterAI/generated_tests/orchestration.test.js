/**
 * MasterAI Orchestration Flow Tests
 * Source: testing/masterAI/orchestration_plan.md
 *
 * Tests multi-agent workflow coordination, lifecycle management,
 * and failure propagation across steps.
 */
const { TestHarness, MockAgent } = require('../TestHarness');

describe('MasterAI Orchestration Flows', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    // ========================================
    // 1. Tenant Onboarding Flow (Happy Path)
    // ========================================
    describe('Tenant Onboarding Flow', () => {
        test('ORCH-001: All 4 agents called in correct order, workflow COMPLETED', async () => {
            harness.logicEngine.defineWorkflow('tenant_onboarding', 'payment.received', [
                { name: 'RecordPayment', tool: 'Finance.record_txn', args: { type: 'deposit' } },
                { name: 'AssignUnit', tool: 'Property.assign_unit', args: { unit: 'A101' } },
                { name: 'ConvertToTenant', tool: 'CRM.convert_to_tenant', args: {} },
                { name: 'SendWelcome', tool: 'Chat.send_welcome', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('tenant_onboarding', {
                applicant_id: '123',
                role: 'applicant'
            });
            await new Promise(r => setTimeout(r, 500));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');
            expect(details.history.length).toBe(4);

            // Verify correct agent dispatch order
            expect(details.history[0].step.tool).toBe('Finance.record_txn');
            expect(details.history[1].step.tool).toBe('Property.assign_unit');
            expect(details.history[2].step.tool).toBe('CRM.convert_to_tenant');
            expect(details.history[3].step.tool).toBe('Chat.send_welcome');

            // Verify each agent was actually called
            expect(harness.getCallHistory('Finance').length).toBe(1);
            expect(harness.getCallHistory('Property').length).toBe(1);
            expect(harness.getCallHistory('CRM').length).toBe(1);
            expect(harness.getCallHistory('Chat').length).toBe(1);
        });
    });

    // ========================================
    // 2. Payment Failure Flow
    // ========================================
    describe('Payment Failure Flow', () => {
        test('ORCH-002: Finance failure stops workflow, Chat never called', async () => {
            // Configure Finance to crash
            harness.configureMock('Finance', 'record_txn', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('payment_fail', 'payment.received', [
                { name: 'RecordPayment', tool: 'Finance.record_txn', args: {} },
                { name: 'NotifyUser', tool: 'Chat.send_error', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('payment_fail', {});
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('FAILED');

            // Step 2 must NOT have been reached
            const chatCalls = harness.getCallHistory('Chat');
            expect(chatCalls.length).toBe(0);

            // Finance was called (and crashed)
            const financeCalls = harness.getCallHistory('Finance');
            expect(financeCalls.length).toBe(1);
        });

        test('ORCH-003: Mid-flow failure preserves completed step history', async () => {
            // Step 1 succeeds, Step 2 crashes
            harness.configureMock('Property', 'assign_unit', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('mid_fail', 'payment.received', [
                { name: 'RecordPayment', tool: 'Finance.record_txn', args: {} },
                { name: 'AssignUnit', tool: 'Property.assign_unit', args: {} },
                { name: 'Notify', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('mid_fail', {});
            await new Promise(r => setTimeout(r, 400));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('FAILED');
            // Step 1 was successful and recorded
            expect(details.history.length).toBe(1);
            expect(details.history[0].step.tool).toBe('Finance.record_txn');
            expect(details.history[0].status).toBe('SUCCESS');
        });
    });

    // ========================================
    // 3. Workflow Lifecycle Management
    // ========================================
    describe('Workflow Lifecycle', () => {
        test('ORCH-004: Pause workflow stops execution', async () => {
            // Use a slow mock to give time to pause
            harness.configureMock('CRM', 'add_lead', { mode: 'SUCCESS', delay: 200 });
            harness.configureMock('Chat', 'reply', { mode: 'SUCCESS', delay: 200 });

            harness.logicEngine.defineWorkflow('pause_test', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} },
                { name: 'Step2', tool: 'Chat.reply', args: {} },
                { name: 'Step3', tool: 'Finance.record_txn', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('pause_test', {});

            // Immediately pause
            const paused = harness.logicEngine.pauseWorkflow(wfId);
            expect(paused).toBe(true);

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('PAUSED');
        });

        test('ORCH-005: Cancel workflow marks CANCELLED with reason', async () => {
            harness.logicEngine.defineWorkflow('cancel_test', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('cancel_test', {});
            const cancelled = harness.logicEngine.cancelWorkflow(wfId, 'User requested');

            expect(cancelled).toBe(true);
            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('CANCELLED');
            expect(details.cancellationReason).toBe('User requested');
        });

        test('ORCH-006: Retry failed workflow step resumes execution', async () => {
            // First run: Finance fails
            harness.configureMock('Finance', 'record_txn', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('retry_test', 'test.event', [
                { name: 'Step1', tool: 'Finance.record_txn', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('retry_test', {});
            await new Promise(r => setTimeout(r, 200));

            let details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('FAILED');

            // Now fix the mock and retry
            harness.configureMock('Finance', 'record_txn', { mode: 'SUCCESS' });
            const retried = harness.logicEngine.retryWorkflowStep(wfId);
            expect(retried).toBe(true);

            await new Promise(r => setTimeout(r, 300));

            details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');
        });

        test('ORCH-007: Cannot retry a non-failed workflow', async () => {
            harness.logicEngine.defineWorkflow('no_retry', 'test.event', [
                { name: 'Step1', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('no_retry', {});
            await new Promise(r => setTimeout(r, 200));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');

            // Retry on completed workflow should return false
            const retried = harness.logicEngine.retryWorkflowStep(wfId);
            expect(retried).toBe(false);
        });
    });

    // ========================================
    // 4. Workflow Listing & Filtering
    // ========================================
    describe('Workflow Querying', () => {
        test('ORCH-008: listActiveWorkflows returns running workflows', async () => {
            harness.configureMock('CRM', 'add_lead', { mode: 'SUCCESS', delay: 500 });

            harness.logicEngine.defineWorkflow('list_test', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} }
            ], {});

            await harness.logicEngine.executeWorkflow('list_test', {});

            const running = harness.logicEngine.listActiveWorkflows('RUNNING');
            expect(running.length).toBeGreaterThanOrEqual(1);
            expect(running[0].status).toBe('RUNNING');
        });

        test('ORCH-009: getWorkflowDetails returns null for unknown ID', () => {
            const details = harness.logicEngine.getWorkflowDetails('WF-nonexistent-12345');
            expect(details).toBeNull();
        });
    });
});
