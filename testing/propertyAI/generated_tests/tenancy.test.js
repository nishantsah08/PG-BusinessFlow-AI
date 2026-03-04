const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Tenancy Management', () => {
    let agent;
    let propertyId;
    let unitId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', {
            name: 'TenancyHouse',
            address: 'Suburb',
            amenities: []
        });
        propertyId = prop.property_id;

        const unit = await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: 'T-01'
        });
        unitId = unit.unit_id;
    });

    test('Assign Tenant to AVAILABLE Unit', async () => {
        const res = await agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-001',
            start_date: '2024-03-01',
            monthly_rent: 10000,
            security_deposit: 2000
        });

        expect(res.status).toBe('Tenant Assigned');
        expect(res.lead_id).toBe('Lead-001');

        const unit = await agent.callTool('get_units', { unit_id: unitId });
        expect(unit.status).toBe('BOOKED');
        expect(unit.tenant_id).toBe('Lead-001');
    });

    test('Assign Tenant to BOOKED Unit (Fail)', async () => {
        // First booking
        await agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-001',
            start_date: '2024-03-01'
        });

        // Second booking attempt
        await expect(agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-002',
            start_date: '2024-04-01'
        })).rejects.toThrow('Unit is already BOOKED');
    });

    test('Vacate Tenant (Future Date -> NOTICE)', async () => {
        // Setup: Book the unit
        await agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-001',
            start_date: '2024-03-01'
        });

        // Vacate in future
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 15); // +15 days

        const res = await agent.callTool('vacate_tenant', {
            unit_id: unitId,
            end_date: futureDate.toISOString()
        });

        expect(res.current_status).toBe('NOTICE');

        const unit = await agent.callTool('get_units', { unit_id: unitId });
        expect(unit.status).toBe('NOTICE');
        expect(unit.tenant_id).toBe('Lead-001'); // Tenant still assigned
    });

    test('Vacate Tenant (Past Date -> AVAILABLE)', async () => {
        // Setup: Book the unit
        await agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-001',
            start_date: '2024-03-01'
        });

        // Vacate in past
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1); // Yesterday

        const res = await agent.callTool('vacate_tenant', {
            unit_id: unitId,
            end_date: pastDate.toISOString()
        });

        expect(res.current_status).toBe('AVAILABLE');

        const unit = await agent.callTool('get_units', { unit_id: unitId });
        expect(unit.status).toBe('AVAILABLE');
        expect(unit.tenant_id).toBeNull();
    });

    test('Assign Tenant to NOTICE Unit (Rebooking)', async () => {
        // Setup: Book -> Notice
        await agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-001',
            start_date: '2024-03-01'
        });

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        await agent.callTool('vacate_tenant', {
            unit_id: unitId,
            end_date: futureDate.toISOString()
        });

        // Rebook with new lead
        const res = await agent.callTool('assign_tenant', {
            unit_id: unitId,
            lead_id: 'Lead-002',
            start_date: futureDate.toISOString()
        });

        expect(res.status).toBe('Tenant Assigned');

        const unit = await agent.callTool('get_units', { unit_id: unitId });
        expect(unit.status).toBe('BOOKED');
        expect(unit.tenant_id).toBe('Lead-002');
    });
});
