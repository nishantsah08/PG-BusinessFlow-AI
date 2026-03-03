const FinanceAI = require('../../../server/src/agents/FinanceAI');

describe('Finance AI - Carry Forward Allocation', () => {
    let finance;

    beforeEach(() => {
        finance = new FinanceAI();
    });

    test('surplus from incoming transaction is carried to next month and auto-applied on bill generation', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-CF-1',
            negotiated_rent: 12000
        });

        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-CF-1',
            month_year: 'Mar 2026'
        });

        const txn = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-CF-1',
            amount: 15000,
            payment_mode: 'UPI',
            date: '2026-03-15'
        });

        expect(txn.status).toBe('SUCCESS');
        expect(txn.surplus).toBe(3000);
        expect(txn.carry_forward).toBeTruthy();
        expect(txn.carry_forward.amount).toBe(3000);
        expect(txn.carry_forward.available_from).toBe('Apr 2026');

        const aprilBill = await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-CF-1',
            month_year: 'Apr 2026'
        });

        expect(aprilBill.status).toBe('SUCCESS');
        expect(aprilBill.applied_carry_forward.amount).toBe(3000);
        expect(aprilBill.applied_carry_forward.allocations).toHaveLength(1);
        expect(aprilBill.applied_carry_forward.allocations[0].category).toBe('Rent');

        const ledger = await finance.callTool('get_ledger', { payer_id: 'Tenant-CF-1' });
        const aprRent = ledger.entries.find(e => e.month_year === 'Apr 2026' && e.category === 'Rent');
        expect(aprRent).toBeTruthy();
        expect(aprRent.amount_due).toBe(12000);
        expect(aprRent.amount_paid).toBe(3000);
        expect(aprRent.balance).toBe(9000);
        expect(aprRent.status).toBe('PARTIALLY_PAID');
    });

    test('carry-forward is not applied before its availability month', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-CF-2',
            negotiated_rent: 10000
        });

        const txn = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-CF-2',
            amount: 2000,
            date: '2026-03-20'
        });
        expect(txn.carry_forward.available_from).toBe('Apr 2026');

        const marchBill = await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-CF-2',
            month_year: 'Mar 2026'
        });
        expect(marchBill.applied_carry_forward.amount).toBe(0);
    });
});
