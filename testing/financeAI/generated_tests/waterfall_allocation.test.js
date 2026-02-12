const FinanceAI = require('../../../server/src/agents/FinanceAI');

describe('Finance AI — Waterfall Allocation (Layer 1)', () => {
    let finance;

    beforeEach(() => {
        finance = new FinanceAI();
    });

    test('TXN-01/02: Payment must strictly follow waterfall priority order', async () => {
        // Setup ledger dues in reverse priority order
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Tenant-1',
            category: 'Electricity Bill',
            amount_due: 500
        });
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Tenant-1',
            category: 'Rent',
            amount_due: 12000
        });
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Tenant-1',
            category: 'Security Deposit',
            amount_due: 2500
        });

        // Pay exactly 3000
        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 3000
        });

        // Expected Allocation:
        // 1. Security Deposit (2500) -> PAID
        // 2. Rent (500) -> PARTIALLY_PAID
        // 3. Electricity Bill (0) -> PENDING

        expect(result.allocations).toHaveLength(2);
        expect(result.allocations[0].category).toBe('Security Deposit');
        expect(result.allocations[0].amount_allocated).toBe(2500);
        expect(result.allocations[1].category).toBe('Rent');
        expect(result.allocations[1].amount_allocated).toBe(500);

        const security = finance.ledgerEntries.find(e => e.category === 'Security Deposit');
        const rent = finance.ledgerEntries.find(e => e.category === 'Rent');
        const electricity = finance.ledgerEntries.find(e => e.category === 'Electricity Bill');

        expect(security.status).toBe('PAID');
        expect(rent.status).toBe('PARTIALLY_PAID');
        expect(rent.balance).toBe(11500);
        expect(electricity.status).toBe('PENDING');
    });

    test('TXN-03: Sum of allocations must equal transaction amount', async () => {
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Tenant-1',
            category: 'Rent',
            amount_due: 10000
        });
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Tenant-1',
            category: 'Late Payment Fees',
            amount_due: 500
        });

        const amount = 5500.55;
        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: amount
        });

        const totalAllocated = result.allocations.reduce((acc, curr) => acc + curr.amount_allocated, 0);
        expect(totalAllocated + (result.surplus || 0)).toBeCloseTo(amount);
    });

    test('TXN-04: Transactions should be immutable (Mocking Check)', async () => {
        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 1000,
            txn_id: 'FIXED-ID'
        });

        const txn = finance.transactions.find(t => t.txn_id === 'FIXED-ID');
        expect(txn).toBeDefined();

        // Attempt to modify (manual simulation of tampering if it were allowed)
        // In real system, no tool should exist to update this.
    });
});
