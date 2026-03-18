const WorkflowStore = require('../src/storage/WorkflowStore');
const { ensurePredefinedFinancialWorkflows } = require('../src/workflows/financialWorkflowPolicy');
const { resolveFinanceButtonContracts } = require('../src/workflows/financeButtonContracts');
const FinanceAI = require('../src/agents/FinanceAI');

describe('Finance button workflow contracts', () => {
    it('resolves effective workflow contracts for finance action buttons', () => {
        const store = new WorkflowStore({ backend: 'memory', memoryWorkflows: [] });
        ensurePredefinedFinancialWorkflows(store);
        const financeAI = new FinanceAI();
        const toolSchemas = Object.fromEntries(
            financeAI.getTools().map((tool) => [tool.name, tool.input_schema || {}])
        );

        const contracts = resolveFinanceButtonContracts(store.list(), 'default', toolSchemas);
        const byTool = Object.fromEntries(contracts.map((row) => [row.tool_name, row]));

        expect(byTool.record_incoming_txn.workflow_id).toBe('finance_record_incoming_txn_v1');
        expect(byTool.record_booking_hold.workflow_id).toBe('finance_record_booking_hold_v1');
        expect(byTool.complete_onboarding_from_booking.workflow_id).toBe('finance_complete_onboarding_from_booking_v1');
        expect(byTool.record_outgoing_txn.workflow_id).toBe('finance_record_outgoing_txn_v1');
        expect(byTool.add_vendor.workflow_id).toBe('finance_add_vendor_v1');

        expect(byTool.record_booking_hold.context_keys).toEqual(
            expect.arrayContaining(['payer_id', 'amount', 'linked_property_id', 'linked_unit_id'])
        );
        expect(byTool.complete_onboarding_from_booking.required_context_keys).toEqual(
            expect.arrayContaining(['booking_hold_id', 'lead_id', 'onboarding_date', 'negotiated_rent'])
        );
        expect(byTool.record_outgoing_txn.any_of_context_keys).toEqual(
            expect.arrayContaining([expect.arrayContaining(['vendor_id', 'payee'])])
        );
        expect(Array.isArray(byTool.record_outgoing_txn.field_schema)).toBe(true);
        const outgoingVendorField = byTool.record_outgoing_txn.field_schema.find((field) => field.key === 'vendor_id');
        expect(outgoingVendorField?.source).toBe('vendor_select');
        expect(outgoingVendorField?.any_of_group_indexes).toContain(0);
    });
});
