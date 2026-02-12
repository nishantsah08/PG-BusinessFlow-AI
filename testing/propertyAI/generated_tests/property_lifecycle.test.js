const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Full Lifecycle Integration', () => {
    let agent;

    beforeEach(() => {
        agent = new PropertyAI();
    });

    test('E2E: Property -> Unit -> Meter -> Booking -> Notice', async () => {
        // 1. Create Property
        const prop = await agent.callTool('add_property', {
            name: 'GrandHotel',
            address: 'Downtown',
            amenities: ['WiFi', 'Pool']
        });
        expect(prop.status).toBe('Property Added');

        // 2. Add Unit
        const unit = await agent.callTool('add_unit', {
            property_id: prop.property_id,
            unit_number: 'Penthouse',
            amenities: ['WiFi'] // Valid subset
        });
        expect(unit.status).toBe('Unit Added');

        // 3. Add Meter & Link
        const meter = await agent.callTool('add_meter', {
            consumer_number: 'E-PH-01',
            linked_units: [unit.unit_id],
            initial_reading: 1000
        });
        expect(meter.status).toBe('Meter Added');

        // 4. Calculate Deposit (Pre-booking check)
        const deposit = await agent.callTool('calculate_deposit', {
            monthly_rent: 50000,
            start_date: '2024-02-01' // Standard
        });
        expect(deposit.total_deposit).toBe(2500);

        // 5. Book Unit (Status Transition)
        const booking = await agent.callTool('update_unit', {
            unit_id: unit.unit_id,
            status: 'BOOKED',
            tenant_id: 'VIP-User'
        });
        expect(booking.current_status).toBe('BOOKED');

        // 6. Verify Double Booking Prevention
        await expect(
            agent.callTool('update_unit', { unit_id: unit.unit_id, status: 'BOOKED', tenant_id: 'Other' })
        ).rejects.toThrow('Unit is already booked');

        // 7. Move to Notice
        const notice = await agent.callTool('update_unit', {
            unit_id: unit.unit_id,
            status: 'NOTICE'
        });
        expect(notice.current_status).toBe('NOTICE');

        // 8. Attempt Deletion (Should be Soft Delete due to history)
        const del = await agent.callTool('delete_unit', { unit_id: unit.unit_id });
        expect(del.status).toBe('Unit Soft Deleted');
    });
});
