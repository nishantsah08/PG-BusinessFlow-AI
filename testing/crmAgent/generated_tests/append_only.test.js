const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Append-Only Logic', () => {
    let agent;
    const ID = '8888888888';

    beforeEach(async () => {
        agent = new CRMAgent();
        await agent.callTool('add_lead', { name: 'Immutable User', primary_phone: ID });
        await agent.callTool('add_manual_note', { lead_id: ID, content: 'Note 1' });
    });

    test('INV-05: Timeline is Immutable (API Surface)', async () => {
        // Attempt to "Update" an event via standard tools (should not exist)
        // If we had an 'update_event' tool, we'd test it fails. 
        // Since we don't, we verify that tools which *could* mutate (like update_lead_snapshot) do NOT touch timeline.

        await agent.callTool('update_lead_snapshot', { lead_id: ID, demographics: { age: 30 } });

        const res = await agent.callTool('get_timeline', { lead_id: ID });
        expect(res.events.length).toBe(2); // Creation + Note 1
        expect(res.events[0].content).toBe('Note 1');
    });

    test('Regression: No Delete Tool', async () => {
        // Verify delete_event is not consistent with defined capabilities
        const tools = agent.getStatus().capabilities.tools;
        expect(tools).not.toContain('delete_event');
        expect(tools).not.toContain('update_event');
    });
});
