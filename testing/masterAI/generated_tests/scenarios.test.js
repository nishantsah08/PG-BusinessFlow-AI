/**
 * MasterAI Scenario Library & Regression Tests
 * Source: testing/masterAI/scenario_library.md + regression_suite.md
 *
 * Covers happy paths, failure/resilience, edge cases,
 * and core regression sanity checks.
 */
const { TestHarness, MockAgent } = require('../TestHarness');
const EventBus = require('../../../server/src/master_ai/services/EventBus');

describe('MasterAI Scenarios & Regression', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
    });

    // ====================================================
    // REGRESSION SUITE — Core Sanity (Deployment Blockers)
    // ====================================================
    describe('Regression: Core Sanity', () => {
        test('INV-001: LogicEngine instantiates without crash', () => {
            expect(harness.logicEngine).toBeDefined();
            expect(harness.logicEngine.workflows).toBeDefined();
            expect(harness.logicEngine.activeWorkflows).toBeDefined();
        });

        test('INV-002: LogicEngine can define and store workflows', () => {
            harness.logicEngine.defineWorkflow('reg_wf1', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} }
            ], {});
            harness.logicEngine.defineWorkflow('reg_wf2', 'test.event', [
                { name: 'Step1', tool: 'Chat.reply', args: {} }
            ], {});

            expect(harness.logicEngine.workflows['reg_wf1']).toBeDefined();
            expect(harness.logicEngine.workflows['reg_wf2']).toBeDefined();
            expect(harness.logicEngine.workflows['reg_wf1'].steps.length).toBe(1);
        });

        test('INV-003: EventBus routes messages correctly (publish -> subscribe)', () => {
            const eventBus = new EventBus();
            const received = [];

            eventBus.subscribe('test.ping', (event) => {
                received.push(event);
            });

            eventBus.publish('test.ping', { message: 'hello' });
            eventBus.publish('test.ping', { message: 'world' });
            eventBus.publish('test.other', { message: 'ignored' });

            expect(received.length).toBe(2);
            expect(received[0].payload.message).toBe('hello');
            expect(received[1].payload.message).toBe('world');
        });

        test('INV-003b: EventBus stores event history', () => {
            const eventBus = new EventBus();
            eventBus.publish('topic.a', { data: 1 });
            eventBus.publish('topic.b', { data: 2 });
            eventBus.publish('topic.a', { data: 3 });

            const allEvents = eventBus.getRecentEvents(50);
            expect(allEvents.length).toBe(3);

            const filteredEvents = eventBus.getRecentEvents(50, 'topic.a');
            expect(filteredEvents.length).toBe(2);
        });

        test('INV-003c: EventBus Dead Letter Queue captures handler errors', () => {
            const eventBus = new EventBus();

            eventBus.subscribe('test.fail', () => {
                throw new Error('Handler exploded');
            });

            eventBus.publish('test.fail', { data: 'boom' });

            const dlq = eventBus.getDeadLetterQueue();
            expect(dlq.length).toBe(1);
            expect(dlq[0].error).toContain('Handler exploded');
        });
    });

    // ====================================================
    // HAPPY PATH SCENARIOS
    // ====================================================
    describe('Happy Path Scenarios', () => {
        test('SCN-001: End-to-end booking flow completes', async () => {
            harness.logicEngine.defineWorkflow('booking_e2e', 'message.received', [
                { name: 'CheckAvailability', tool: 'Property.get_availability', args: {} },
                { name: 'BookUnit', tool: 'Property.assign_unit', args: { unit: 'B202' } },
                { name: 'ConfirmToUser', tool: 'Chat.reply', args: { text: 'Booking confirmed!' } }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('booking_e2e', {
                user_id: 'U-100',
                intent: 'book_visit'
            });
            await new Promise(r => setTimeout(r, 400));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');
            expect(details.history.length).toBe(3);

            // All agents called
            expect(harness.getCallHistory('Property').length).toBe(2);
            expect(harness.getCallHistory('Chat').length).toBe(1);
        });

        test('SCN-002: Maintenance request via chat', async () => {
            harness.logicEngine.defineWorkflow('maintenance_req', 'message.received', [
                { name: 'LogTicket', tool: 'Property.log_maintenance_req', args: { issue: 'leak' } },
                { name: 'Confirm', tool: 'Chat.reply', args: { text: 'Ticket logged' } }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('maintenance_req', {
                user_id: 'U-200',
                role: 'tenant'
            });
            await new Promise(r => setTimeout(r, 300));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('COMPLETED');
            expect(harness.getCallHistory('Property').length).toBe(1);
            expect(harness.getCallHistory('Chat').length).toBe(1);
        });
    });

    // ====================================================
    // FAILURE & RESILIENCE SCENARIOS
    // ====================================================
    describe('Failure & Resilience', () => {
        test('SCN-ERR-002: Agent crash during multi-step flow — workflow fails, earlier steps preserved', async () => {
            // Step 2 (Property) crashes
            harness.configureMock('Property', 'assign_unit', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('crash_mid', 'payment.received', [
                { name: 'RecordPayment', tool: 'Finance.record_txn', args: {} },
                { name: 'AssignUnit', tool: 'Property.assign_unit', args: {} },
                { name: 'SendConfirm', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('crash_mid', {});
            await new Promise(r => setTimeout(r, 400));

            const details = harness.logicEngine.getWorkflowDetails(wfId);
            expect(details.status).toBe('FAILED');
            expect(details.error).toContain('Crash Sim');
            // Step 1 succeeded
            expect(details.history.length).toBe(1);
            expect(details.history[0].step.tool).toBe('Finance.record_txn');
            // Step 3 never reached
            expect(harness.getCallHistory('Chat').length).toBe(0);
        });

        test('SCN-ERR-002b: After crash, engine handles retry and recovers', async () => {
            harness.configureMock('Finance', 'record_txn', { mode: 'EXCEPTION' });

            harness.logicEngine.defineWorkflow('crash_retry', 'test.event', [
                { name: 'Step1', tool: 'Finance.record_txn', args: {} },
                { name: 'Step2', tool: 'Chat.reply', args: {} }
            ], {});

            const wfId = await harness.logicEngine.executeWorkflow('crash_retry', {});
            await new Promise(r => setTimeout(r, 200));
            expect(harness.logicEngine.getWorkflowDetails(wfId).status).toBe('FAILED');

            // Fix mock and retry
            harness.configureMock('Finance', 'record_txn', { mode: 'SUCCESS' });
            harness.logicEngine.retryWorkflowStep(wfId);
            await new Promise(r => setTimeout(r, 300));

            expect(harness.logicEngine.getWorkflowDetails(wfId).status).toBe('COMPLETED');
        });
    });

    // ====================================================
    // EDGE CASES (Aspirational — .todo for future features)
    // ====================================================
    describe('Edge Cases', () => {
        test.todo('SCN-EDGE-001: Duplicate webhook — idempotency key deduplication');
        test.todo('SCN-EDGE-002: Replayed event stream — state unchanged (idempotency)');
        test.todo('SCN-EDGE-003: Race condition — concurrent events lock and serialize');
        test.todo('SCN-ERR-001: Payment gateway timeout > 60s — reconciliation');
        test.todo('SCN-ERR-003: Rollback on critical failure — compensation flow');
    });

    // ====================================================
    // PERFORMANCE BASELINES
    // ====================================================
    describe('Performance', () => {
        test('PERF-001: 20 concurrent workflows complete without crash', async () => {
            const CONCURRENT = 20;
            const wfIds = [];

            // Define workflow once
            harness.logicEngine.defineWorkflow('perf_test', 'test.event', [
                { name: 'Step1', tool: 'CRM.add_lead', args: {} },
                { name: 'Step2', tool: 'Chat.reply', args: {} }
            ], {});

            // Launch all concurrently
            for (let i = 0; i < CONCURRENT; i++) {
                const wfId = await harness.logicEngine.executeWorkflow('perf_test', { run: i });
                wfIds.push(wfId);
            }

            // Wait for all to settle
            await new Promise(r => setTimeout(r, 1000));

            // Verify all completed
            let completed = 0;
            let failed = 0;
            for (const wfId of wfIds) {
                const details = harness.logicEngine.getWorkflowDetails(wfId);
                expect(details).not.toBeNull();
                if (details.status === 'COMPLETED') completed++;
                if (details.status === 'FAILED') failed++;
                // None should be stuck in RUNNING
                expect(details.status).not.toBe('RUNNING');
            }

            expect(completed).toBe(CONCURRENT);
            expect(failed).toBe(0);
        }, 10000); // 10s timeout for this test
    });
});
