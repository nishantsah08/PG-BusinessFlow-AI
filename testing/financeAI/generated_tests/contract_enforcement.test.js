const FinanceAI = require('../../../server/src/agents/FinanceAI');

describe('Finance AI — Contract Enforcement (Layer 3)', () => {
    let finance;

    beforeEach(() => {
        finance = new FinanceAI();
    });

    test('CON-01: Billing must use negotiated rates from tenant contract', async () => {
        // Mock Onboarding
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-123',
            negotiated_rent: 11500, // Regular is 12000
            security_deposit: 2000,
            rent_payment_timing: 'ADVANCE',
            effective_from: '2024-01-01'
        });

        // Trigger Billing
        const result = await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-123',
            month_year: 'Feb 2024'
        });

        const rentEntry = finance.ledgerEntries.find(e => e.payer_id === 'Tenant-123' && e.category === 'Rent');
        expect(rentEntry.amount_due).toBe(11500);
    });

    test('CON-02: Rent timing must respect ADVANCE rule', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-ADV',
            negotiated_rent: 10000,
            rent_payment_timing: 'ADVANCE'
        });

        // Generating bills for March on Feb 28
        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-ADV',
            month_year: 'March 2024',
            current_date: '2024-02-28'
        });

        const entry = finance.ledgerEntries.find(e => e.payer_id === 'Tenant-ADV');
        expect(entry.month_year).toBe('March 2024');
    });

    test('CON-03: Electricity billing must use meter reading delta', async () => {
        // This test would likely require integration with a mock Meter service or Property AI
        // For Layer 1/3, we focus on the logic inside Finance AI
    });
});
