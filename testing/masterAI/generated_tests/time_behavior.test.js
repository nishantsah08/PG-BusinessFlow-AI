/**
 * Phase 2 — Time Behavior Tests
 * Proves: deterministic time control via clock override.
 * No real-time delays — all time is simulated.
 */
const { TestHarness } = require('../TestHarness');

describe('Phase 2: Time Behavior', () => {
    let harness;

    beforeEach(() => {
        harness = new TestHarness();
        // Pin clock to a known epoch for deterministic tests
        harness.setSystemTime(1700000000000); // Nov 14 2023 22:13:20 UTC
    });

    test('TIME-01: Timeout Enforcement — slow agent step cancelled', async () => {
        // Configure agent with 500ms delay
        harness.configureMock('Property', 'get_availability', {
            mode: 'SUCCESS',
            delay: 500,
            response: { available: true }
        });

        // Workflow with 100ms step timeout — step MUST finish within 100ms
        harness.logicEngine.defineWorkflow('timeout_wf', 'test.event', [
            { name: 'CheckAvail', tool: 'Property.get_availability', args: {} }
        ], {}, { stepTimeout: 100 });

        const wfId = await harness.logicEngine.executeWorkflow('timeout_wf', {});
        await new Promise(r => setTimeout(r, 700));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('FAILED');
        expect(details.error).toBe('STEP_TIMEOUT');
    });

    test('TIME-02: Deadline Expiry — workflow past deadline fails before next step', async () => {
        // Set deadline 5 seconds from now
        const now = harness.now();
        const deadline = now + 5000;

        harness.logicEngine.defineWorkflow('deadline_wf', 'test.event', [
            { name: 'Step1', tool: 'CRM.add_lead', args: {} },
            { name: 'Step2', tool: 'Chat.reply', args: {} }
        ], {}, { deadline });

        // Advance clock past deadline BEFORE executing
        harness.advanceTime(6000); // now = original + 6s, past deadline

        const wfId = await harness.logicEngine.executeWorkflow('deadline_wf', {});
        await new Promise(r => setTimeout(r, 300));

        const details = harness.logicEngine.getWorkflowDetails(wfId);
        expect(details.status).toBe('FAILED');
        expect(details.error).toBe('DEADLINE_EXPIRED');

        // No agents were called — deadline checked before first step
        expect(harness.getCallHistory('CRM').length).toBe(0);
        expect(harness.getCallHistory('Chat').length).toBe(0);
    });

    test('TIME-03: Scheduled Event Trigger — clock advance fires event', () => {
        const firedEvents = [];
        harness.eventBus.subscribe('timer.daily_check', (event) => {
            firedEvents.push(event);
        });

        // Schedule event 10 seconds from now
        const triggerTime = harness.now() + 10000;
        harness.logicEngine.scheduleEvent('timer.daily_check', {
            type: 'maintenance_audit'
        }, triggerTime);

        // Before trigger time — nothing fires
        harness.advanceTime(5000);
        expect(firedEvents.length).toBe(0);

        // Advance past trigger time
        harness.advanceTime(6000); // total: 11s past original
        expect(firedEvents.length).toBe(1);
        expect(firedEvents[0].payload.type).toBe('maintenance_audit');

        // Advancing again doesn't re-fire (marked as fired)
        harness.advanceTime(5000);
        expect(firedEvents.length).toBe(1);
    });

    test('TIME-04: Session Expiry — advance 15 min closes session', () => {
        // Create session with 15-minute TTL
        const TTL_15_MIN = 15 * 60 * 1000;
        const session = harness.logicEngine.createSession('SES-001', TTL_15_MIN);

        expect(session.status).toBe('ACTIVE');

        // Advance 10 minutes — still active
        harness.advanceTime(10 * 60 * 1000);
        let checked = harness.logicEngine.checkSessionExpiry('SES-001');
        expect(checked.status).toBe('ACTIVE');

        // Advance 6 more minutes — now expired (total 16 min)
        harness.advanceTime(6 * 60 * 1000);
        checked = harness.logicEngine.checkSessionExpiry('SES-001');
        expect(checked.status).toBe('EXPIRED');

        // Subsequent checks still show expired
        checked = harness.logicEngine.checkSessionExpiry('SES-001');
        expect(checked.status).toBe('EXPIRED');
    });
});
