const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Merge Logic', () => {
    let agent;
    const SOURCE_ID = '1111111111';
    const TARGET_ID = '2222222222';

    beforeEach(async () => {
        agent = new CRMAgent();
        // Setup Source (Enquiry with History)
        await agent.callTool('add_lead', {
            name: 'Source User',
            primary_phone: SOURCE_ID,
            source: { category: 'Web', detail: 'Form' }
        });
        await agent.callTool('add_manual_note', { lead_id: SOURCE_ID, content: 'Source Note 1' });

        // Setup Target (Visited)
        await agent.callTool('add_lead', {
            name: 'Target User',
            primary_phone: TARGET_ID
        });
        await agent.callTool('change_status', {
            lead_id: TARGET_ID,
            to_status: 'Visited',
            reason: 'Visit'
        });
    });

    test('INV-04: Merge Preserves Data & Redirects Identity', async () => {
        const mergeRes = await agent.callTool('merge_leads', {
            source_lead_id: SOURCE_ID,
            target_lead_id: TARGET_ID,
            relationship: 'Duplicate'
        });

        expect(mergeRes.status).toBe('Merge Complete');
        expect(mergeRes.surviving_lead_id).toBe(TARGET_ID);

        // 1. Source should be gone
        const sourceSearch = await agent.callTool('get_lead', { phone: SOURCE_ID }); // Should fail or return Target?
        // Current implementation: _findLeadByPhone searches primary AND secondary.
        // Since Source's phone is moved to Target's secondary, this should return TARGET!
        expect(sourceSearch.status).toBe('Found');
        expect(sourceSearch.lead.lead_id).toBe(TARGET_ID);

        // 2. Target should have Source's phone
        const targetLead = sourceSearch.lead;
        expect(targetLead.phones.others.find(p => p.number === SOURCE_ID)).toBeDefined();

        // 3. Target should have Source's timeline
        const timelineRes = await agent.callTool('get_timeline', { lead_id: TARGET_ID });
        const events = timelineRes.events;

        // Events:
        // Source: Creation, Note 1
        // Target: Creation, Status Change(Visited)
        // Merge: MERGE event
        // Total: 5 events
        expect(events.length).toBe(5);

        // Verify Content
        expect(events.find(e => e.content === 'Source Note 1')).toBeDefined();

        // Verify Merge Event
        const mergeEvent = events.find(e => e.type === 'MERGE');
        expect(mergeEvent.absorbed_lead_id).toBe(SOURCE_ID);
    });
});
