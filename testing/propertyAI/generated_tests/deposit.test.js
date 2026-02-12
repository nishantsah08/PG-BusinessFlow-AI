const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Deposit Calculation (Financial Logic)', () => {
    let agent;

    beforeEach(() => {
        agent = new PropertyAI();
    });

    test('Standard Deposit (1st-5th): Should be flat 2500', async () => {
        const result = await agent.callTool('calculate_deposit', {
            monthly_rent: 12000,
            start_date: '2024-01-02'
        });
        expect(result.total_deposit).toBe(2500);
        expect(result.rule_applied).toContain('Standard');
    });

    test('Boundary (5th): Last day of Standard Deposit', async () => {
        const result = await agent.callTool('calculate_deposit', {
            monthly_rent: 12000,
            start_date: '2024-01-05'
        });
        expect(result.total_deposit).toBe(2500);
    });

    test('Boundary (6th): First day of Dynamic Deposit', async () => {
        // Rent = 12000 => Daily = 400
        // Dynamic = 400 * 5 = 2000
        // Rounding: 2000 (already nearest 50)
        // Total = 2500 + 2000 = 4500
        const result = await agent.callTool('calculate_deposit', {
            monthly_rent: 12000,
            start_date: '2024-01-06'
        });
        expect(result.total_deposit).toBe(4500);
        expect(result.rule_applied).toContain('Dynamic');
    });

    test('Dynamic Calculation Rounding Logic', async () => {
        // Rent = 12100 => Daily = 403.33
        // Dynamic = 403.33 * 5 = 2016.66
        // Round to 50 => 2000
        // Total = 2500 + 2000 = 4500
        const result = await agent.callTool('calculate_deposit', {
            monthly_rent: 12100,
            start_date: '2024-01-07'
        });
        expect(result.total_deposit).toBe(4500);
    });

    test('Boundary (10th): Last day of Dynamic Deposit', async () => {
        const result = await agent.callTool('calculate_deposit', {
            monthly_rent: 12000,
            start_date: '2024-01-10'
        });
        expect(result.total_deposit).toBe(4500);
    });

    test('Boundary (11th): Back to Standard (Default)', async () => {
        // Current implementation defaults to Standard for else cases
        const result = await agent.callTool('calculate_deposit', {
            monthly_rent: 12000,
            start_date: '2024-01-11'
        });
        expect(result.total_deposit).toBe(2500);
    });
});
