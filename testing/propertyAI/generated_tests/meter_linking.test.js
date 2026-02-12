const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Meter Linking', () => {
    let agent;
    let propId;
    let u1, u2, u3;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', { name: 'MeterTest', address: 'M1' });
        propId = prop.property_id;
        const unit1 = await agent.callTool('add_unit', { property_id: propId, unit_number: 'U1' });
        const unit2 = await agent.callTool('add_unit', { property_id: propId, unit_number: 'U2' });
        const unit3 = await agent.callTool('add_unit', { property_id: propId, unit_number: 'U3' });
        u1 = unit1.unit_id;
        u2 = unit2.unit_id;
        u3 = unit3.unit_id;
    });

    test('Success: One Meter linked to Multiple Units (1:M)', async () => {
        const res = await agent.callTool('add_meter', {
            consumer_number: 'C100',
            linked_units: [u1, u2]
        });
        expect(res.status).toBe('Meter Added');
    });

    test('Failure: Link Meter to Non-Existent Unit', async () => {
        await expect(
            agent.callTool('add_meter', {
                consumer_number: 'C101',
                linked_units: [u1, 'UNIT-999']
            })
        ).rejects.toThrow('One or more linked units do not exist');
    });

    test('Failure: Unit already linked to another Meter', async () => {
        // Link u1 to first meter
        await agent.callTool('add_meter', { consumer_number: 'C102', linked_units: [u1] });

        // Try linking u1 to second meter — should fail
        await expect(
            agent.callTool('add_meter', { consumer_number: 'C103', linked_units: [u1] })
        ).rejects.toThrow('already linked to meter');
    });

    test('Success: Different Units can link to different Meters', async () => {
        await agent.callTool('add_meter', { consumer_number: 'C104', linked_units: [u1] });

        // u2 is free, should succeed
        const res = await agent.callTool('add_meter', { consumer_number: 'C105', linked_units: [u2] });
        expect(res.status).toBe('Meter Added');
    });

    test('Failure: Partial overlap — one unit in list already linked', async () => {
        await agent.callTool('add_meter', { consumer_number: 'C106', linked_units: [u1] });

        // u3 is free but u1 is taken — should fail
        await expect(
            agent.callTool('add_meter', { consumer_number: 'C107', linked_units: [u3, u1] })
        ).rejects.toThrow('already linked to meter');
    });
});
