const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Meter Readings', () => {
    let agent;
    let meterId;
    let meterNoInitId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', { name: 'ReadingTest', address: 'R1' });
        const unit = await agent.callTool('add_unit', { property_id: prop.property_id, unit_number: 'R101' });
        const unit2 = await agent.callTool('add_unit', { property_id: prop.property_id, unit_number: 'R102' });

        // Meter WITH initial reading (100)
        const meter = await agent.callTool('add_meter', {
            consumer_number: 'RDG-001',
            linked_units: [unit.unit_id],
            initial_reading: 100
        });
        meterId = meter.meter_id;

        // Meter WITHOUT initial reading
        const meter2 = await agent.callTool('add_meter', {
            consumer_number: 'RDG-002',
            linked_units: [unit2.unit_id]
        });
        meterNoInitId = meter2.meter_id;
    });

    // --- Monotonic Reading Validation ---

    test('Success: Reading increases', async () => {
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 200 });
        const res = await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 350 });
        expect(res.status).toBe('Reading Updated');
        expect(res.new_count).toBe(3); // initial(100) + 200 + 350
    });

    test('Success: Same reading (no change)', async () => {
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 200 });
        const res = await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 200 });
        expect(res.status).toBe('Reading Updated');
    });

    test('Failure: Reading decreases', async () => {
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 500 });
        await expect(
            agent.callTool('update_meter_reading', { meter_id: meterId, reading: 400 })
        ).rejects.toThrow('Meter readings cannot decrease');
    });

    test('Failure: First reading below initial', async () => {
        await expect(
            agent.callTool('update_meter_reading', { meter_id: meterId, reading: 50 })
        ).rejects.toThrow('Meter readings cannot decrease');
    });

    // --- Delete Meter Reading ---

    test('Success: Delete most recent reading', async () => {
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 200 });
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 300 });

        const res = await agent.callTool('delete_meter_reading', { meter_id: meterId });
        expect(res.status).toBe('Reading Deleted');
        expect(res.removed_reading.value).toBe(300);
        expect(res.remaining_count).toBe(2); // initial(100) + 200
    });

    test('Failure: Delete when no readings exist', async () => {
        await expect(
            agent.callTool('delete_meter_reading', { meter_id: meterNoInitId })
        ).rejects.toThrow('No readings to delete');
    });

    test('After delete, can add lower reading (since last was removed)', async () => {
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 200 });
        await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 500 });

        // Delete the 500 reading
        await agent.callTool('delete_meter_reading', { meter_id: meterId });

        // Now 200 is the last reading, so 300 should succeed
        const res = await agent.callTool('update_meter_reading', { meter_id: meterId, reading: 300 });
        expect(res.status).toBe('Reading Updated');
    });
});
