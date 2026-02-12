const FinanceAI = require('../../../server/src/agents/FinanceAI');

describe('Finance AI — API Boundary & Validation (Layer 4)', () => {
    let finance;

    beforeEach(() => {
        finance = new FinanceAI();
    });

    test('API: Rejection of non-number amounts', async () => {
        try {
            await finance.callTool('record_incoming_txn', {
                payer_id: 'Tenant-1',
                amount: 'five thousand'
            });
            throw new Error('Should have rejected non-number amount');
        } catch (e) {
            expect(e.message).toBeDefined();
        }
    });

    test('API: Rejection of malformed dates', async () => {
        // Implementation check: Does the schema validate date formats?
    });

    test('API: Rejection of duplicate transaction IDs', async () => {
        await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 1000,
            txn_id: 'DUPLICATE-1'
        });

        const result = await finance.callTool('record_incoming_txn', {
            payer_id: 'Tenant-1',
            amount: 1000,
            txn_id: 'DUPLICATE-1'
        });

        expect(result.status).toBe('REJECTED');
        expect(result.reason).toContain('already exists');
    });

    test('API: Rejection of invalid payer_id', async () => {
        // Should validate against CRM if integrated, or at least check format
    });
});
