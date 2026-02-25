const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Email Lookup', () => {
    let agent;

    beforeEach(async () => {
        agent = new CRMAgent();
        // Seed a lead with an email
        await agent.callTool('add_lead', {
            name: 'Rahul Sharma',
            primary_phone: '+919800098000',
            email: 'Rahul.Sharma@Gmail.com',
            source: { category: 'WhatsApp', detail: null }
        });
    });

    test('EMAIL-01: get_lead_by_email finds existing lead', async () => {
        const res = await agent.callTool('get_lead_by_email', { email: 'rahul.sharma@gmail.com' });
        expect(res.status).toBe('Found');
        expect(res.lead.name).toBe('Rahul Sharma');
        expect(res.lead.lead_id).toBe('+919800098000');
    });

    test('EMAIL-02: get_lead_by_email returns Not Found for unknown email', async () => {
        const res = await agent.callTool('get_lead_by_email', { email: 'unknown@example.com' });
        expect(res.status).toBe('Not Found');
    });

    test('EMAIL-03: get_lead_by_email is case-insensitive', async () => {
        // Seed email was "Rahul.Sharma@Gmail.com" — test with different cases
        const res1 = await agent.callTool('get_lead_by_email', { email: 'RAHUL.SHARMA@GMAIL.COM' });
        expect(res1.status).toBe('Found');
        expect(res1.lead.name).toBe('Rahul Sharma');

        const res2 = await agent.callTool('get_lead_by_email', { email: 'rahul.sharma@gmail.com' });
        expect(res2.status).toBe('Found');

        const res3 = await agent.callTool('get_lead_by_email', { email: '  Rahul.Sharma@Gmail.com  ' });
        expect(res3.status).toBe('Found');
    });
});
