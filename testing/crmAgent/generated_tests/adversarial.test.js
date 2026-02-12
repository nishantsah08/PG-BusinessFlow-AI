const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Adversarial Scenarios', () => {
    let agent;

    beforeEach(() => {
        agent = new CRMAgent();
    });

    test('ADV-01: 3 Numbers / 1 Person (Merge Chain)', async () => {
        // A, B, C are same person.
        const A = '1000000000';
        const B = '2000000000';
        const C = '3000000000';

        await agent.callTool('add_lead', { name: 'User A', primary_phone: A });
        await agent.callTool('add_lead', { name: 'User B', primary_phone: B });
        await agent.callTool('add_lead', { name: 'User C', primary_phone: C });

        // Merge A -> B
        await agent.callTool('merge_leads', { source_lead_id: A, target_lead_id: B });

        // Merge B -> C (Chain)
        await agent.callTool('merge_leads', { source_lead_id: B, target_lead_id: C });

        // Result: C should have phones A and B
        const res = await agent.callTool('get_lead_by_phone', { phone: C });

        const phones = res.lead.phones.others.map(p => p.number);
        expect(phones).toContain(A);
        expect(phones).toContain(B);

        // Timeline check: C should have creation events of A and B
        const timeline = await agent.callTool('get_timeline', { lead_id: C });
        expect(timeline.events.length).toBeGreaterThanOrEqual(3); // 3 creations + 2 merges
    });

    test('ADV-03: Cycle Lifecycle to Exhaustion', async () => {
        const ID = '9999999999';
        await agent.callTool('add_lead', { name: 'Cyclist', primary_phone: ID });

        // Cycle 1
        await agent.callTool('change_status', { lead_id: ID, to_status: 'Visited', reason: 'V1' });
        await agent.callTool('change_status', { lead_id: ID, to_status: 'Onboarded', reason: 'O1' });
        await agent.callTool('change_status', { lead_id: ID, to_status: 'Left', reason: 'L1' });
        await agent.callTool('change_status', { lead_id: ID, to_status: 'Enquiry', reason: 'Back' });

        // Cycle 2 Start
        const res = await agent.callTool('change_status', { lead_id: ID, to_status: 'Visited', reason: 'V2' });
        expect(res.current).toBe('Visited');

        // Verify Timeline Length
        const t = await agent.callTool('get_timeline', { lead_id: ID });
        // 1 (Enq) + 4 (Cycle 1) + 1 (V2) = 6 events
        expect(t.events.length).toBe(6);
    });
});
