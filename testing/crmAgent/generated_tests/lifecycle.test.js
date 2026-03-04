const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Lifecycle State Machine', () => {
    let agent;
    const ID = '9000090000';

    beforeEach(async () => {
        agent = new CRMAgent();
        await agent.callTool('add_lead', { name: 'Lifecycle Tester', primary_phone: ID });
    });

    test('INV-09: Valid Lifecycle Flow', async () => {
        // Enq -> Visited
        let res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Visited', reason: 'Visited' });
        expect(res.current).toBe('Visited');

        // Visited -> Onboarded
        res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Onboarded', reason: 'Joined' });
        expect(res.current).toBe('Onboarded');

        // Onboarded -> Left
        res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Left', reason: 'Left' });
        expect(res.current).toBe('Left');

        // Left -> Enquiry
        res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Enquiry', reason: 'Back' });
        expect(res.current).toBe('Enquiry');
    });

    test('INV-09: Invalid Transitions (Regression Lock)', async () => {
        // Enquiry -> Onboarded (Skip Visit)
        let res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Onboarded', reason: 'Skip' });
        expect(res.status).toBe('Invalid Transition');

        // Enquiry -> Left
        res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Left', reason: 'Skip' });
        expect(res.status).toBe('Invalid Transition');
    });

    test('INV-10: Status Sync', async () => {
        await agent.callTool('change_status', { lead_id: ID, to_status: 'Visited', reason: 'Check' });

        const leadRes = await agent.callTool('get_lead', { phone: ID });
        const timeline = leadRes.timeline;
        const lastEvent = timeline[timeline.length - 1];

        expect(leadRes.lead.status).toBe('Visited');
        expect(lastEvent.type).toBe('STATUS_CHANGE');
        expect(lastEvent.to).toBe('Visited');
    });
});
