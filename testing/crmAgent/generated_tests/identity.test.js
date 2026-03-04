const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Identity Invariants', () => {
    let agent;

    beforeEach(() => {
        agent = new CRMAgent();
    });

    test('INV-01: Identity is Primary Phone', async () => {
        const phone = '+919876543210';
        await agent.callTool('add_lead', {
            name: 'Test User',
            primary_phone: phone
        });

        const res = await agent.callTool('get_lead_by_phone', { phone });
        expect(res.lead.lead_id).toBe(phone);
        expect(res.lead.phones.primary.number).toBe(phone);
    });

    test('INV-02: Global Uniqueness - Duplicate Primary', async () => {
        const phone = '+915555555555';
        await agent.callTool('add_lead', { name: 'User A', primary_phone: phone });

        const res = await agent.callTool('add_lead', { name: 'User B', primary_phone: phone });
        expect(res.status).toBe('Conflict');
        expect(res.message).toContain('Lead already exists');
    });

    test('INV-02: Global Uniqueness - Secondary Collision', async () => {
        // This test requires advanced implementation in _findLeadByPhone to check ALL phones
        // The implementation does this via iteration.

        // 1. User A has secondary phone X
        await agent.callTool('add_lead', { name: 'User A', primary_phone: '1111111111' });
        await agent.callTool('add_secondary_phone', {
            lead_id: '1111111111',
            phone_number: '2222222222'
        });

        // 2. User B tries to use phone X as primary
        const res = await agent.callTool('add_lead', {
            name: 'User B',
            primary_phone: '2222222222'
        });

        expect(res.status).toBe('Conflict');
    });
});
