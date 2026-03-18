const CRMAgent = require('../src/agents/CRMAgent');

describe('CRMAgent search and lead filters', () => {
    let crmAgent;
    const tenantId = 'tenant_crm_search_filters';

    beforeEach(async () => {
        process.env.STORAGE_BACKEND = 'memory';
        crmAgent = new CRMAgent();

        await crmAgent.callTool('add_lead', {
            tenant_id: tenantId,
            name: 'Amit Sharma',
            primary_phone: '+919800098000',
            email: 'amit@example.com',
            profile_type: 'Customer',
        });
        await crmAgent.callTool('add_lead', {
            tenant_id: tenantId,
            name: 'Priya Staff',
            primary_phone: '+919811112222',
            email: 'priya.staff@example.com',
            profile_type: 'Staff',
        });
        await crmAgent.callTool('add_lead', {
            tenant_id: tenantId,
            name: 'Owner One',
            primary_phone: '+919822223333',
            email: 'owner.one@example.com',
            profile_type: 'CEO',
        });

        await crmAgent.callTool('change_status', {
            tenant_id: tenantId,
            lead_id: '+919800098000',
            to_status: 'Visited',
            reason: 'Visited property',
        });
        await crmAgent.callTool('change_status', {
            tenant_id: tenantId,
            lead_id: '+919822223333',
            to_status: 'Visited',
            reason: 'Owner record initialized',
        });
        await crmAgent.callTool('change_status', {
            tenant_id: tenantId,
            lead_id: '+919822223333',
            to_status: 'Onboarded',
            reason: 'Owner account active',
        });
    });

    it('searches leads by name, phone, and email', async () => {
        const byName = await crmAgent.callTool('search_leads', {
            tenant_id: tenantId,
            query: 'amit',
            limit: 20,
            offset: 0,
        });
        const byPhone = await crmAgent.callTool('search_leads', {
            tenant_id: tenantId,
            query: '9800098000',
            limit: 20,
            offset: 0,
        });
        const byEmail = await crmAgent.callTool('search_leads', {
            tenant_id: tenantId,
            query: 'priya.staff@example.com',
            limit: 20,
            offset: 0,
        });

        expect(byName.leads.map((lead) => lead.lead_id)).toContain('+919800098000');
        expect(byPhone.leads.map((lead) => lead.lead_id)).toContain('+919800098000');
        expect(byEmail.leads.map((lead) => lead.lead_id)).toContain('+919811112222');
    });

    it('applies status and profile filters to search results', async () => {
        const visitedCustomers = await crmAgent.callTool('search_leads', {
            tenant_id: tenantId,
            query: 'a',
            status: 'Visited',
            profile_type: 'Customer',
            limit: 20,
            offset: 0,
        });

        expect(visitedCustomers.count).toBe(1);
        expect(visitedCustomers.leads[0]?.lead_id).toBe('+919800098000');
    });

    it('filters recent leads by status and profile', async () => {
        const staffOnly = await crmAgent.callTool('get_recent_leads', {
            tenant_id: tenantId,
            limit: 20,
            profile_type: 'Staff',
        });
        const onboardedOnly = await crmAgent.callTool('get_recent_leads', {
            tenant_id: tenantId,
            limit: 20,
            status: 'Onboarded',
        });

        expect(staffOnly.leads).toHaveLength(1);
        expect(staffOnly.leads[0]?.lead_id).toBe('+919811112222');
        expect(onboardedOnly.leads).toHaveLength(1);
        expect(onboardedOnly.leads[0]?.lead_id).toBe('+919822223333');
    });
});
