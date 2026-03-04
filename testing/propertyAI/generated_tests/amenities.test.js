const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Amenities Validation', () => {
    let agent;
    let propId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', {
            name: 'AmenityTower',
            address: '123 Tech Park',
            amenities: ['WiFi', 'Gym', 'Parking']
        });
        propId = prop.property_id;
    });

    test('Unit Creation: Inherits Property Amenities by default', async () => {
        const unit = await agent.callTool('add_unit', {
            property_id: propId,
            unit_number: '101'
        });
        const u = await agent.callTool('get_units', { unit_id: unit.unit_id });
        expect(u.amenities).toEqual(expect.arrayContaining(['WiFi', 'Gym', 'Parking']));
    });

    test('Unit Creation: Valid Subset', async () => {
        const unit = await agent.callTool('add_unit', {
            property_id: propId,
            unit_number: '102',
            amenities: ['WiFi'] // Only WiFi
        });
        const u = await agent.callTool('get_units', { unit_id: unit.unit_id });
        expect(u.amenities).toEqual(['WiFi']);
    });

    test('Unit Creation: Invalid Amenity (Not in Property)', async () => {
        await expect(
            agent.callTool('add_unit', {
                property_id: propId,
                unit_number: '103',
                amenities: ['WiFi', 'Swimming Pool'] // Pool not in Property
            })
        ).rejects.toThrow('Unit cannot have amenities not present in Property');
    });

    test('Unit Update: Cannot add invalid amenity', async () => {
        const unit = await agent.callTool('add_unit', {
            property_id: propId,
            unit_number: '104',
            amenities: ['WiFi']
        });

        await expect(
            agent.callTool('update_unit', {
                unit_id: unit.unit_id,
                amenities: ['WiFi', 'Bowling Alley']
            })
        ).rejects.toThrow('Unit must have subset of Property amenities');
    });
});
