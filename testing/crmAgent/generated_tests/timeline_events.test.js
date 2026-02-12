const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Timeline & Interactions', () => {
    let agent;

    beforeEach(async () => {
        agent = new CRMAgent();
        // Setup a base lead for all tests
        await agent.callTool('add_lead', {
            name: 'Timeline User',
            primary_phone: '5555555555'
        });
    });

    test('Log Session Event', async () => {
        const sessionData = {
            lead_id: '5555555555',
            interaction_type: 'Call',
            participants: [{ role: 'User', name: 'Timeline User' }],
            summary: 'Discussed pricing',
            sentiment: 'Positive',
            tone: 'Curious',
            financial_impact: 'Budget 20k',
            compliance_impact: null,
            links: { artifacts: ['http://rec.wav'] }
        };

        const res = await agent.callTool('log_session', sessionData);
        expect(res.status).toBe('Session Logged');
        expect(res.event_id).toBeDefined();

        // Verify Timeline
        const timelineRes = await agent.callTool('get_timeline', { lead_id: '5555555555' });
        const events = timelineRes.events;

        // Should have 2 events: Creation(STATUS_CHANGE) + Session
        expect(events.length).toBe(2);
        const sessionEvent = events.find(e => e.type === 'SESSION');
        expect(sessionEvent.summary).toBe('Discussed pricing');
        expect(sessionEvent.links.artifacts[0]).toBe('http://rec.wav');
    });

    test('Manual Note & Chronological Sorting', async () => {
        // Add Note 1
        await agent.callTool('add_manual_note', {
            lead_id: '5555555555',
            content: 'Note 1',
            author: 'Agent A'
        });

        // Add Note 2 (Simulation of later time is tricky in unit test without mocking Date, 
        // but implementation uses Date.now(), so execution order should suffice for sorting if fast enough 
        // OR we trust the array order naturally appended)

        await agent.callTool('add_manual_note', {
            lead_id: '5555555555',
            content: 'Note 2',
            author: 'Agent B'
        });

        const timelineRes = await agent.callTool('get_timeline', { lead_id: '5555555555' });
        const events = timelineRes.events;

        // Expect Note 2 to be before Note 1 (Desc Sort)
        // Since execution is super fast, timestamps might be identical.
        // Implementation uses: events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        // If timestamps identical, sort might be stable or browser dependent.
        // Let's verify content presence atleast.

        expect(events[0].content).toBe('Note 2'); // Most recent
        expect(events[1].content).toBe('Note 1');
    });

    test('Artifact Linking & Retrieval', async () => {
        // 1. Link Artifact
        await agent.callTool('link_artifact', {
            lead_id: '5555555555',
            file_url: 'http://docs.pdf',
            file_type: 'Document',
            description: 'KYC'
        });

        // 2. Log Session with Artifact
        await agent.callTool('log_session', {
            lead_id: '5555555555',
            summary: 'Sent Contract',
            links: { artifacts: ['http://contract.pdf'] }
        });

        // 3. Get All Artifacts
        const artifactsRes = await agent.callTool('get_lead_artifacts', { lead_id: '5555555555' });
        expect(artifactsRes.count).toBe(2);

        const urls = artifactsRes.artifacts.map(a => a.url);
        expect(urls).toContain('http://docs.pdf');
        expect(urls).toContain('http://contract.pdf');
    });
});
