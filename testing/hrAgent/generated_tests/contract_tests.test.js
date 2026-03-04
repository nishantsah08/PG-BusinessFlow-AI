const HRAgent = require('../../../server/src/agents/HRAgent');

// Simulating Finance Agent Contract Validation
describe('HR Agent Contract Tests (Layer 3 - Finance Handover)', () => {
    let hrAgent;

    beforeEach(() => {
        hrAgent = new HRAgent();
    });

    const FinanceContractSchema = {
        required_fields: ['staff_id', 'base_salary', 'bank_details', 'effective_from'],
        bank_details_fields: ['account_number', 'ifsc']
    };

    test('Contract: Salary Card matches Finance Schema', async () => {
        const hire = await hrAgent.callTool('hire_staff', { name: "FinUser", designation: "Audit", contact: { primary: "1231231234" } });

        await hrAgent.callTool('create_salary_card', {
            staff_id: hire.staff_id,
            base_salary: 45000,
            bank_details: {
                account_number: "9876543210",
                ifsc: "SBIN0001234",
                bank_name: "SBI"
            },
            effective_from: "2024-04-01"
        });

        const card = await hrAgent.callTool('get_salary_card', { staff_id: hire.staff_id });

        // Validate Required Fields
        FinanceContractSchema.required_fields.forEach(field => {
            expect(card).toHaveProperty(field);
        });

        // Validate Bank Details
        FinanceContractSchema.bank_details_fields.forEach(field => {
            expect(card.bank_details).toHaveProperty(field);
        });

        // Validate Data Types
        expect(typeof card.base_salary).toBe('number');
        expect(card.base_salary).toBeGreaterThanOrEqual(0);
        expect(typeof card.effective_from).toBe('string');
    });

    test('Contract: Incentive Structure is readable', async () => {
        const hire = await hrAgent.callTool('hire_staff', { name: "SalesUser", designation: "Sales", contact: { primary: "1231230000" } });

        await hrAgent.callTool('create_salary_card', {
            staff_id: hire.staff_id,
            base_salary: 20000,
            bank_details: { account_number: "1", ifsc: "1" },
            components: {
                incentives: {
                    logic: "Standard",
                    amount_per_unit: 100
                }
            }
        });

        const card = await hrAgent.callTool('get_salary_card', { staff_id: hire.staff_id });
        expect(card.components).toBeDefined();
        if (card.components.incentives) {
            expect(typeof card.components.incentives.amount_per_unit).toBe('number');
        }
    });
});
