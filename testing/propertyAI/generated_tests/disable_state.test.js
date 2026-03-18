const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Disable-Enable State Rules', () => {
    let agent;
    let propId;
    let unitId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', {
            name: 'State Test Property',
            address: 'State Avenue 1',
            image_urls: ['https://example.com/preview.jpg'],
            amenities: ['WiFi']
        });
        propId = prop.property_id;

        const unit = await agent.callTool('add_unit', {
            property_id: propId,
            unit_number: '201'
        });
        unitId = unit.unit_id;
    });

    test('Disabled property blocks operations', async () => {
        const disable = await agent.callTool('disable_property', { property_id: propId });
        expect(disable.status).toBe('Property Disabled');

        const prop = agent.properties.find((p) => p.id === propId);
        expect(prop.is_enabled).toBe(false);

        await expect(
            agent.callTool('add_unit', {
                property_id: propId,
                unit_number: '202'
            })
        ).rejects.toThrow('Cannot add unit to a disabled property.');

        const enabled = await agent.callTool('enable_property', { property_id: propId });
        expect(enabled.status).toBe('Property Enabled');
        const refetched = await agent.callTool('add_unit', {
            property_id: propId,
            unit_number: '202'
        });
        expect(refetched.status).toBe('Unit Added');
    });

    test('Disabled unit blocks assignments and updates', async () => {
        await agent.callTool('update_unit', {
            unit_id: unitId,
            status: 'BOOKED',
            tenant_id: 'tenant-100'
        });

        const disable = await agent.callTool('disable_unit', { unit_id: unitId });
        expect(disable.status).toBe('Unit Disabled');

        const unit = agent.units.find((u) => u.id === unitId);
        expect(unit.is_enabled).toBe(false);

        await expect(
            agent.callTool('assign_tenant', {
                unit_id: unitId,
                lead_id: 'tenant-101',
                start_date: '2026-04-01'
            })
        ).rejects.toThrow('Cannot assign tenant to disabled unit.');

        await expect(
            agent.callTool('update_unit', {
                unit_id: unitId,
                status: 'NOTICE'
            })
        ).rejects.toThrow('Cannot modify a disabled unit.');
    });

    test('get_public_rate_card includes expanded rate card schema', async () => {
        const rateCard = await agent.callTool('get_public_rate_card');

        expect(rateCard.monthly_rent).toBeDefined();
        expect(rateCard.base_security_deposit).toBeDefined();
        expect(rateCard.payment_cycle_rules).toBeDefined();
        expect(rateCard.notice_period_days).toBeDefined();
        expect(rateCard.min_stay_months).toBeDefined();
        expect(rateCard.early_exit_rule).toBeDefined();
        expect(rateCard.rent_payment_timing).toBeDefined();
        expect(rateCard.utility_payment_timing).toBeDefined();
        expect(rateCard.maintenance_fee).toBeDefined();
    });
});
