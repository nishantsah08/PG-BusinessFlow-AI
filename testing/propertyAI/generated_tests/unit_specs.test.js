const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Unit Specs (Types & Floor)', () => {
    let agent;
    let propertyId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', {
            name: 'SpecsTower',
            address: 'Tech Park',
            amenities: ['WiFi', 'AC', 'Gym'],
            floors: 10
        });
        propertyId = prop.property_id;
    });

    test('Add Unit with Types and Floor', async () => {
        const unit = await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: '101',
            floor: 1,
            types: ['Double Sharing', 'Balcony'],
            amenities: ['WiFi']
        });

        expect(unit.status).toBe('Unit Added');

        const fetched = await agent.callTool('get_units', { unit_id: unit.unit_id });
        expect(fetched.floor).toBe(1);
        expect(fetched.types).toContain('Double Sharing');
        expect(fetched.types).toContain('Balcony');
    });

    test('Update Unit Types and Floor', async () => {
        const unit = await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: '102',
            floor: 1
        });

        await agent.callTool('update_unit', {
            unit_id: unit.unit_id,
            floor: 2,
            types: ['Single Room']
        });

        const fetched = await agent.callTool('get_units', { unit_id: unit.unit_id });
        expect(fetched.floor).toBe(2);
        expect(fetched.types).toContain('Single Room');
    });

    test('Filter Units by Floor', async () => {
        await agent.callTool('add_unit', { property_id: propertyId, unit_number: 'F1', floor: 1 });
        await agent.callTool('add_unit', { property_id: propertyId, unit_number: 'F2', floor: 2 });
        await agent.callTool('add_unit', { property_id: propertyId, unit_number: 'F2B', floor: 2 });

        const floor2Units = await agent.callTool('get_units', { property_id: propertyId, floor: 2 });
        expect(floor2Units.length).toBe(2);
        expect(floor2Units[0].unit_number).toBe('F2');
    });

    test('Filter Units by Type', async () => {
        await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: 'T1',
            types: ['Double Sharing']
        });
        await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: 'T2',
            types: ['Single Room']
        });
        await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: 'T3',
            types: ['Double Sharing', 'AC']
        });

        const doubles = await agent.callTool('get_units', {
            property_id: propertyId,
            types: ['Double Sharing']
        });

        // Should find T1 and T3
        expect(doubles.length).toBe(2);
        const numbers = doubles.map(u => u.unit_number);
        expect(numbers).toContain('T1');
        expect(numbers).toContain('T3');
    });
});
