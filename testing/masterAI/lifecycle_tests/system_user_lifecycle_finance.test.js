const MasterAI = require('../../../server/src/agents/MasterAI');
const FinanceAI = require('../../../server/src/agents/FinanceAI');
const WorkflowStore = require('../../../server/src/storage/WorkflowStore');

describe('System User Life Cycle Test - Deterministic Financial Workflows', () => {
    beforeAll(() => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    });

    test('System User Life Cycle Test: predefined finance workflows exist with plain-English user view', () => {
        const financeAI = new FinanceAI();
        // Instantiation triggers predefined workflow seeding.
        new MasterAI([financeAI]);

        const workflowStore = new WorkflowStore({ backend: process.env.STORAGE_BACKEND || 'local' });
        const wf = workflowStore.getById('finance_record_incoming_txn_v1');

        expect(wf).toBeTruthy();
        expect(wf.protected).toBe(true);
        expect(wf.deterministic).toBe(true);
        expect(wf.user_view_title).toBeTruthy();
        expect(Array.isArray(wf.user_view_steps)).toBe(true);
        expect(wf.user_view_steps.length).toBeGreaterThan(0);
    });

    test('System User Life Cycle Test: incoming payment is blocked until CEO authorization', async () => {
        const financeAI = new FinanceAI();
        const masterAI = new MasterAI([financeAI]);

        const result = await masterAI.executeSubagentTool('FinanceAI', 'record_incoming_txn', {
            payer_id: 'Tenant-Det-1',
            amount: 2500
        });

        expect(result.status).toBe('PENDING_CEO_AUTHORIZATION');
        expect(result.authorization_id).toBeTruthy();
        expect(result.workflow_id).toBe('finance_record_incoming_txn_v1');
        expect(financeAI.transactions.length).toBe(0);
    });

    test('System User Life Cycle Test: incoming payment executes via predefined workflow after CEO authorization', async () => {
        const financeAI = new FinanceAI();
        const masterAI = new MasterAI([financeAI]);

        const pending = await masterAI.executeSubagentTool('FinanceAI', 'record_incoming_txn', {
            payer_id: 'Tenant-Det-2',
            amount: 3000,
            payment_mode: 'UPI'
        });
        expect(pending.status).toBe('PENDING_CEO_AUTHORIZATION');

        const approval = await masterAI.callTool('approve_financial_workflow_request', {
            authorization_id: pending.authorization_id,
            approved_by: 'nishantsah@outlook.in'
        });

        expect(approval.success).toBe(true);
        const result = approval.result;
        expect(result.status).toBe('SUCCESS');
        expect(result.workflow_id).toBe('finance_record_incoming_txn_v1');
        expect(result.deterministic).toBe(true);
        expect(financeAI.transactions.length).toBe(1);
    });

    test('System User Life Cycle Test: sales can trigger and CEO can complete deterministic outgoing finance flow', async () => {
        const financeAI = new FinanceAI();
        const masterAI = new MasterAI([financeAI]);

        const employees = [
            { name: 'Operations Manager', approved_by: 'ops.manager@bestpg.local' },
            { name: 'Caretaker', approved_by: 'caretaker@bestpg.local' }
        ];

        for (const emp of employees) {
            const pending = await masterAI.executeSubagentTool('FinanceAI', 'record_outgoing_txn', {
                category: 'OpEx',
                sub_category: 'Maintenance',
                work_done: `Lifecycle expense initiated for ${emp.name}`,
                property_id: 'PROP-1',
                amount: 500,
                payee: 'Vendor-1',
                payment_mode: 'UPI',
                approved_by: emp.approved_by,
                remarks: `Requested by ${emp.name}`
            });

            expect(pending.status).toBe('PENDING_CEO_AUTHORIZATION');

            const approval = await masterAI.callTool('approve_financial_workflow_request', {
                authorization_id: pending.authorization_id,
                approved_by: 'nishantsah@outlook.in'
            });

            const result = approval.result;
            expect(result.status).toBe('SUCCESS');
            expect(result.workflow_id).toBe('finance_record_outgoing_txn_v1');
            expect(result.deterministic).toBe(true);
        }

        const outgoingCount = financeAI.transactions.filter(t => t.type === 'OUTGOING').length;
        expect(outgoingCount).toBe(employees.length);
    });
});
