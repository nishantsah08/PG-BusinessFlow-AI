const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Status Transitions (State Machine)', () => {
    let agent;
    let unitId;

    beforeEach(async () => {
        agent = new PropertyAI();
        // Setup Property & Unit
        const prop = await agent.callTool('add_property', { name: 'TestProp', address: '123 St' });
        const unit = await agent.callTool('add_unit', { property_id: prop.property_id, unit_number: '101' });
        unitId = unit.unit_id;
    });

    test('Valid Path: AVAILABLE -> BOOKED -> NOTICE -> AVAILABLE', async () => {
        // 1. Book
        await agent.callTool('update_unit', { unit_id: unitId, status: 'BOOKED', tenant_id: 'tenant-1' });
        let u = await agent.callTool('get_units', { unit_id: unitId });
        expect(u.status).toBe('BOOKED');
        expect(u.tenant_id).toBe('tenant-1');

        // 2. Notice
        await agent.callTool('update_unit', { unit_id: unitId, status: 'NOTICE' });
        u = await agent.callTool('get_units', { unit_id: unitId });
        expect(u.status).toBe('NOTICE');

        // 3. Available
        await agent.callTool('update_unit', { unit_id: unitId, status: 'AVAILABLE' });
        u = await agent.callTool('get_units', { unit_id: unitId });
        expect(u.status).toBe('AVAILABLE');
        expect(u.tenant_id).toBeNull();
    });

    test('Invalid Path: AVAILABLE -> NOTICE', async () => {
        await expect(
            agent.callTool('update_unit', { unit_id: unitId, status: 'NOTICE' })
        ).rejects.toThrow('Invalid status transition');
    });

    test('Invalid Path: BOOKED -> AVAILABLE (Direct)', async () => {
        await agent.callTool('update_unit', { unit_id: unitId, status: 'BOOKED', tenant_id: 't1' });

        await expect(
            agent.callTool('update_unit', { unit_id: unitId, status: 'AVAILABLE' })
        ).rejects.toThrow('Invalid status transition');
    });

    test('Double Booking Prevention', async () => {
        await agent.callTool('update_unit', { unit_id: unitId, status: 'BOOKED', tenant_id: 't1' });

        await expect(
            agent.callTool('update_unit', { unit_id: unitId, status: 'BOOKED', tenant_id: 't2' })
        ).rejects.toThrow('Unit is already booked');
    });

    test('Re-booking from Notice (Valid)', async () => {
        await agent.callTool('update_unit', { unit_id: unitId, status: 'BOOKED', tenant_id: 't1' });
        await agent.callTool('update_unit', { unit_id: unitId, status: 'NOTICE' });

        // Should allow new tenant to book
        await agent.callTool('update_unit', { unit_id: unitId, status: 'BOOKED', tenant_id: 't2' });
        const u = await agent.callTool('get_units', { unit_id: unitId });
        expect(u.status).toBe('BOOKED');
        expect(u.tenant_id).toBe('t2');
    });
});
