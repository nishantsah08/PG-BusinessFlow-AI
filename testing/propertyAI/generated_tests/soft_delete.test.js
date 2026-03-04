const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Soft vs Hard Delete', () => {
    let agent;
    let propId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', { name: 'DeleteTest', address: 'D1' });
        propId = prop.property_id;
    });

    test('Hard Delete: Fresh Unit (No History)', async () => {
        const u = await agent.callTool('add_unit', { property_id: propId, unit_number: '101' });

        const res = await agent.callTool('delete_unit', { unit_id: u.unit_id });
        expect(res.status).toBe('Unit Hard Deleted');

        // Verify it's gone
        const lookup = await agent.callTool('get_units', { unit_id: u.unit_id });
        expect(lookup.error).toBe('Not found');
    });

    test('Soft Delete: Unit with Booking History', async () => {
        const u = await agent.callTool('add_unit', { property_id: propId, unit_number: '102' });

        // Add history
        await agent.callTool('update_unit', {
            unit_id: u.unit_id,
            status: 'BOOKED',
            tenant_id: 'tenant-1'
        });

        const res = await agent.callTool('delete_unit', { unit_id: u.unit_id });
        expect(res.status).toBe('Unit Soft Deleted');

        // Verify excluded from active search
        const lookup = await agent.callTool('get_units', { unit_id: u.unit_id });
        expect(lookup.error).toBe('Not found');

        // Verify Internal State (Simulated Admin Access)
        // We can access agent.units directly since it's in-memory for Phase 1
        const rawUnit = agent.units.find(x => x.id === u.unit_id);
        expect(rawUnit.status).toBe('DELETED');
        expect(rawUnit.history).toHaveLength(1);
    });

    test('Soft Delete: Property with Active Units', async () => {
        const u = await agent.callTool('add_unit', { property_id: propId, unit_number: '103' });

        const res = await agent.callTool('delete_property', { property_id: propId });
        expect(res.status).toBe('Property Soft Deleted');

        // Check internal
        const rawProp = agent.properties.find(p => p.id === propId);
        expect(rawProp.status).toBe('DELETED');
    });

    test('Hard Delete: Property with No Units', async () => {
        const p2 = await agent.callTool('add_property', { name: 'EmptyProp', address: 'E1' });

        const res = await agent.callTool('delete_property', { property_id: p2.property_id });
        expect(res.status).toBe('Property Hard Deleted');

        const rawProp = agent.properties.find(p => p.id === p2.property_id);
        expect(rawProp).toBeUndefined();
    });
});
