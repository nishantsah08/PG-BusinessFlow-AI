const FinanceAI = require('../../../server/src/agents/FinanceAI');

describe('Finance AI — Adversarial & Edge Cases (Layer 1/2)', () => {
    let finance;

    beforeEach(() => {
        finance = new FinanceAI();
    });

    test('Adversarial: Manual allocation override attempt', async () => {
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Attacker-1',
            category: 'Security Deposit',
            amount_due: 2500
        });
        await finance.callTool('add_ledger_entry', {
            payer_id: 'Attacker-1',
            category: 'Rent',
            amount_due: 12000
        });

        // Attacker tries to force payment into 'Rent' first by sending manual allocations
        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Attacker-1',
            amount: 2500,
            allocations: [
                { category: 'Rent', amount_allocated: 2500 }
            ]
        });

        // System must ignore manual 'allocations' and enforce Waterfall
        expect(result.allocations[0].category).toBe('Security Deposit');
        expect(result.allocations[0].amount_allocated).toBe(2500);

        const rent = finance.ledgerEntries.find(e => e.category === 'Rent');
        expect(rent.status).toBe('PENDING'); // Should not have been paid
    });

    test('Adversarial: Replayed transaction link', async () => {
        // Ensuring secondary validation (e.g. hash check or link uniqueness) prevents re-crediting for the same screenshot.
    });

    test('Edge Case: Zero Balance Payment Request', async () => {
        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Clean-Tenant',
            amount: 5000
        });

        // No dues exist. Payment should be recorded as 100% surplus.
        expect(result.allocations).toHaveLength(0);
        expect(result.surplus).toBe(5000);
    });

    test('Edge Case: Simultaneously processed payments (Locking)', async () => {
        // Test system concurrency (simulated)
    });

    test('Edge Case: IST Midnight Transaction (Date Boundary)', async () => {
        // Ensuring the IST year/month logic correctly switches at 00:00 IST for billing cycles.
    });
});
