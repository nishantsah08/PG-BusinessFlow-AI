const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Uniqueness Constraints', () => {
    let agent;

    beforeEach(() => {
        agent = new PropertyAI();
    });

    test('Property Name: Must be unique', async () => {
        await agent.callTool('add_property', { name: 'UniqueTower', address: 'A' });

        await expect(
            agent.callTool('add_property', { name: 'UniqueTower', address: 'B' })
        ).rejects.toThrow('Property with name "UniqueTower" already exists');
    });

    test('Property Update: Cannot rename to existing name', async () => {
        const p1 = await agent.callTool('add_property', { name: 'TowerA', address: 'A' });
        await agent.callTool('add_property', { name: 'TowerB', address: 'B' });

        await expect(
            agent.callTool('update_property', { property_id: p1.property_id, name: 'TowerB' })
        ).rejects.toThrow('Property with name "TowerB" already exists');
    });

    test('Unit Number: Unique per Property', async () => {
        const p = await agent.callTool('add_property', { name: 'TowerC', address: 'C' });
        await agent.callTool('add_unit', { property_id: p.property_id, unit_number: '101' });

        await expect(
            agent.callTool('add_unit', { property_id: p.property_id, unit_number: '101' })
        ).rejects.toThrow('Unit 101 already exists in this property');
    });

    test('Unit Number: Allowed duplicate across different properties', async () => {
        const p1 = await agent.callTool('add_property', { name: 'TowerD', address: 'D' });
        const p2 = await agent.callTool('add_property', { name: 'TowerE', address: 'E' });

        await agent.callTool('add_unit', { property_id: p1.property_id, unit_number: '202' });
        // Should succeed in P2
        await expect(
            agent.callTool('add_unit', { property_id: p2.property_id, unit_number: '202' })
        ).resolves.toHaveProperty('status', 'Unit Added');
    });

    test('Meter Consumer Number: Must be unique', async () => {
        await agent.callTool('add_meter', { consumer_number: 'METER-001' });

        await expect(
            agent.callTool('add_meter', { consumer_number: 'METER-001' })
        ).rejects.toThrow('Meter consumer number already exists');
    });
});
