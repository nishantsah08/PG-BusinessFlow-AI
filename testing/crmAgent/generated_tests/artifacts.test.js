const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Artifacts', () => {
    let agent;
    const ID = '4444444444';

    beforeEach(async () => {
        agent = new CRMAgent();
        await agent.callTool('add_lead', { name: 'Artifact User', primary_phone: ID });
    });

    test('INV-12: Manual Artifact Linking', async () => {
        const url1 = 'gcs://bucket/file1.pdf';

        await agent.callTool('link_artifact', {
            lead_id: ID,
            file_url: url1,
            description: 'ID Proof',
            file_type: 'Document'
        });

        const res = await agent.callTool('get_lead_artifacts', { lead_id: ID });
        expect(res.count).toBe(1);
        expect(res.artifacts[0].url).toBe(url1);
        expect(res.artifacts[0].description).toBe('ID Proof');
    });

    test('INV-12: Session Artifacts Aggregation', async () => {
        const sessionPayload = {
            lead_id: ID,
            interaction_type: 'Call',
            participants: [],
            summary: 'Call with recording',
            links: { artifacts: ['gcs://bucket/rec.wav'] }
        };

        await agent.callTool('log_session', sessionPayload);

        const res = await agent.callTool('get_lead_artifacts', { lead_id: ID });
        expect(res.count).toBe(1);
        expect(res.artifacts[0].url).toBe('gcs://bucket/rec.wav');
    });
});
