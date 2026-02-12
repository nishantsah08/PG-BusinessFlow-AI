const FinanceAI = require('../../../server/src/agents/FinanceAI');

describe('Finance AI — Ledger Integrity (Layer 1)', () => {
    let finance;

    beforeEach(() => {
        finance = new FinanceAI();
    });

    test('LED-01: Ledger entries should be append-only (sequential IDs)', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-1',
            negotiated_rent: 12000
        });

        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-1',
            month_year: 'Jan 2024'
        });

        const initialCount = finance.ledgerEntries.length;
        expect(finance.ledgerEntries[0].id).toBe('LED-1');

        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-1',
            month_year: 'Feb 2024'
        });

        expect(finance.ledgerEntries.length).toBe(initialCount + 1);
        expect(finance.ledgerEntries[1].id).toBe('LED-2');
        expect(finance.ledgerEntries[0].category).toBe('Rent'); // Ensure first entry wasn't overwritten
    });

    test('LED-02: Equation Correctness (Balance = Due - Paid)', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-1',
            negotiated_rent: 10000
        });

        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-1',
            month_year: 'Jan 2024'
        });

        const entry = finance.ledgerEntries[0];
        expect(entry.balance).toBe(entry.amount_due - entry.amount_paid);

        // Record a partial payment
        await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 4000
        });

        const updatedEntry = finance.ledgerEntries[0];
        expect(updatedEntry.amount_paid).toBe(4000);
        expect(updatedEntry.balance).toBe(6000);
        expect(updatedEntry.balance).toBe(updatedEntry.amount_due - updatedEntry.amount_paid);
    });

    test('LED-03: Status must correctly match balance', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-1',
            negotiated_rent: 5000
        });

        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-1',
            month_year: 'Jan 2024'
        });

        expect(finance.ledgerEntries[0].status).toBe('PENDING');

        await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 2000
        });
        expect(finance.ledgerEntries[0].status).toBe('PARTIALLY_PAID');

        await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 3000
        });
        expect(finance.ledgerEntries[0].status).toBe('PAID');
    });

    test('LED-04: No Negative Balances (Overpayment surplus handled)', async () => {
        await finance.callTool('onboard_tenant_contract', {
            lead_id: 'Tenant-1',
            negotiated_rent: 1000
        });

        await finance.callTool('generate_monthly_bills', {
            payer_id: 'Tenant-1',
            month_year: 'Jan 2024'
        });

        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 1500
        });

        const entry = finance.ledgerEntries[0];
        expect(entry.balance).toBe(0);
        expect(entry.status).toBe('PAID');
        expect(result.surplus).toBe(500); // 1500 - 1000
    });
});
