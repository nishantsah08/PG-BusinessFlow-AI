const MasterAI = require('../../../server/src/agents/MasterAI');
const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('MasterAI executeSubagentTool - Property booking tools', () => {
    test('can execute assign_tenant through MasterAI gateway', async () => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

        const propertyAI = new PropertyAI();
        const masterAI = new MasterAI([propertyAI]);

        const prop = await masterAI.executeSubagentTool('PropertyAI', 'add_property', {
            name: 'Gateway Test PG',
            address: 'Dighi Hills, Pune 411015'
        });

        const unit = await masterAI.executeSubagentTool('PropertyAI', 'add_unit', {
            property_id: prop.property_id,
            unit_number: '101A',
            floor: 1,
            amenities: []
        });

        const booking = await masterAI.executeSubagentTool('PropertyAI', 'assign_tenant', {
            unit_id: unit.unit_id,
            lead_id: 'Lead-Exec-1',
            start_date: '2026-03-10',
            monthly_rent: 15000,
            security_deposit: 3000
        });

        expect(booking.status).toBe('Tenant Assigned');

        const fetchedUnit = await masterAI.executeSubagentTool('PropertyAI', 'get_units', { unit_id: unit.unit_id });
        expect(fetchedUnit.status).toBe('BOOKED');
        expect(fetchedUnit.tenant_id).toBe('Lead-Exec-1');
    });
});
