const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Regression Guards (Critical Invariants)', () => {
    let agent;

    beforeEach(() => {
        agent = new PropertyAI();
    });

    // Guard 1: Financial Logic (High Risk)
    test('GUARD: Deposit Logic must handle boundary correctly', async () => {
        const res = await agent.callTool('calculate_deposit', { monthly_rent: 12000, start_date: '2024-01-06' });
        // Must include dynamic part: 2500 + 2000 = 4500
        expect(res.total_deposit).toBe(4500);
    });

    // Guard 2: Data Integrity (High Risk)
    test('GUARD: Property Name Uniqueness', async () => {
        await agent.callTool('add_property', { name: 'GuardProp', address: 'X' });
        await expect(
            agent.callTool('add_property', { name: 'GuardProp', address: 'Y' })
        ).rejects.toThrow('exists');
    });

    // Guard 3: Amenity Subset (Domain Rule)
    test('GUARD: Unit Amenity Subset Validation', async () => {
        const p = await agent.callTool('add_property', { name: 'P', address: 'X', amenities: ['A'] });
        await expect(
            agent.callTool('add_unit', { property_id: p.property_id, unit_number: '1', amenities: ['B'] })
        ).rejects.toThrow('amenities');
    });
});
