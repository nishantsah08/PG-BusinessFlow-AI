const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('CRM Agent: Lead Lifecycle', () => {
    let agent;

    beforeEach(() => {
        agent = new CRMAgent();
    });

    test('Create Lead -> Get Lead -> Change Status', async () => {
        // 1. Create Lead
        const leadData = {
            name: 'Ankit Verma',
            primary_phone: '9800098000',
            email: 'ankit@example.com',
            source: { category: 'Google', detail: 'Maps' },
            demographics: { type: 'Student' },
            preferences: ['Veg', 'Non-Smoker'],
            unit_type_required: 'Single',
            requirement_date: '2024-03-01',
            notes: { urgency: 'High' }
        };

        const createRes = await agent.callTool('add_lead', leadData);
        expect(createRes.status).toBe('Lead Created');
        expect(createRes.lead_id).toBe('+919800098000');

        // 2. Get Lead (Verify Fields)
        const getRes = await agent.callTool('get_lead', { phone: '9800098000' });
        expect(getRes.status).toBe('Found');
        expect(getRes.lead.name).toBe('Ankit Verma');
        expect(getRes.lead.status).toBe('Enquiry');
        expect(getRes.lead.ai_notes.urgency).toBe('High');

        // Verify Timeline has Creation Event
        const timeline = getRes.timeline;
        expect(timeline.length).toBe(1);
        expect(timeline[0].type).toBe('STATUS_CHANGE');
        expect(timeline[0].reason).toBe('Lead Created');

        // 3. Change Status
        const statusRes = await agent.callTool('change_status', {
            lead_id: '9800098000',
            to_status: 'Visited',
            reason: 'Site Visit Done'
        });
        expect(statusRes.current).toBe('Visited');

        // Verify Status in Lead Snapshot
        const updatedLead = await agent.callTool('get_lead', { phone: '9800098000' });
        expect(updatedLead.lead.status).toBe('Visited');
        expect(updatedLead.timeline.length).toBe(2);
        expect(updatedLead.timeline[1].type).toBe('STATUS_CHANGE');
        expect(updatedLead.timeline[1].to).toBe('Visited');
    });

    test('Duplicate Lead Rejection', async () => {
        await agent.callTool('add_lead', { name: 'A', primary_phone: '+919999999999' });

        const res = await agent.callTool('add_lead', { name: 'B', primary_phone: '+919999999999' });
        expect(res.status).toBe('Conflict');
    });

    test('Phone Lookup (Primary)', async () => {
        await agent.callTool('add_lead', { name: 'A', primary_phone: '9999999999' });
        const res = await agent.callTool('get_lead_by_phone', { phone: '9999999999' });
        expect(res.status).toBe('Found');
        expect(res.lead.name).toBe('A');
    });

    test('Add Secondary Phone & Lookup', async () => {
        await agent.callTool('add_lead', { name: 'A', primary_phone: '+911111111111' });

        const addPhone = await agent.callTool('add_secondary_phone', {
            lead_id: '+911111111111',
            phone_number: '+912222222222',
            label: 'Home'
        });

        // Lookup by Secondary
        const res = await agent.callTool('get_lead_by_phone', { phone: '+912222222222' });
        expect(res.status).toBe('Found');
        expect(res.lead.lead_id).toBe('+911111111111'); // Returns the primary lead ID
    });
});
