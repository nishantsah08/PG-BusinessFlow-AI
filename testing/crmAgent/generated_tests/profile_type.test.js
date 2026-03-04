const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Profile Type Logic', () => {
    let agent;

    beforeEach(() => {
        agent = new CRMAgent();
    });

    test('Default profile_type is Customer', async () => {
        const phone = '9999999999';
        const res = await agent.callTool('add_lead', {
            name: 'Default User',
            primary_phone: phone
        });

        expect(res.status).toBe('Lead Created');
        const leadRes = await agent.callTool('get_lead_by_phone', { phone });
        expect(leadRes.lead.profile_type).toBe('Customer');
    });

    test('Can create Staff profile explicitly', async () => {
        const phone = '8888888888';
        const res = await agent.callTool('add_lead', {
            name: 'Staff User',
            primary_phone: phone,
            profile_type: 'Staff'
        });

        expect(res.status).toBe('Lead Created');
        const leadRes = await agent.callTool('get_lead_by_phone', { phone });
        expect(leadRes.lead.profile_type).toBe('Staff');
    });

    test('Can update profile_type to CEO', async () => {
        const phone = '7777777777';
        await agent.callTool('add_lead', {
            name: 'Future CEO',
            primary_phone: phone
        });

        const updateRes = await agent.callTool('update_lead_snapshot', {
            lead_id: phone,
            profile_type: 'CEO'
        });

        expect(updateRes.status).toBe('Snapshot Updated');
        const leadRes = await agent.callTool('get_lead_by_phone', { phone });
        expect(leadRes.lead.profile_type).toBe('CEO');
    });
});
