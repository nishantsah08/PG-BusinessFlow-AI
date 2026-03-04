const TimeAuthorityService = require('../services/TimeAuthorityService');

const FINANCIAL_MUTATION_TOOL_TO_WORKFLOW = {
    onboard_tenant_contract: 'finance_onboard_tenant_contract_v1',
    generate_monthly_bills: 'finance_generate_monthly_bills_v1',
    add_ledger_entry: 'finance_add_ledger_entry_v1',
    record_incoming_txn: 'finance_record_incoming_txn_v1',
    record_outgoing_txn: 'finance_record_outgoing_txn_v1',
    process_salary_payout: 'finance_process_salary_payout_v1'
};

const PREDEFINED_FINANCIAL_WORKFLOWS = [
    {
        workflow_id: 'finance_onboard_tenant_contract_v1',
        name: 'Finance Contract Onboarding',
        description: 'Deterministic workflow for registering negotiated tenant contract terms.',
        user_view_title: 'Onboard Tenant Contract (Plain English)',
        user_view_steps: [
            'Take the approved tenant commercial terms.',
            'Store these terms as the finance contract for that tenant.',
            'Return success only after the contract is stored.'
        ],
        trigger_event: 'finance.contract.onboard.requested',
        trigger_description: 'When finance contract terms are approved and must be locked.',
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_onboard_contract',
                description: 'Persist negotiated contract terms in FinanceAI.',
                agent: 'FinanceAI',
                tool: 'onboard_tenant_contract',
                params: {
                    lead_id: '{{context.lead_id}}',
                    negotiated_rent: '{{context.negotiated_rent}}',
                    security_deposit: '{{context.security_deposit}}',
                    rent_payment_timing: '{{context.rent_payment_timing}}',
                    utility_payment_timing: '{{context.utility_payment_timing}}',
                    effective_from: '{{context.effective_from}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_generate_monthly_bills_v1',
        name: 'Finance Monthly Billing',
        description: 'Deterministic workflow for generating monthly rent/dues.',
        user_view_title: 'Generate Monthly Bills (Plain English)',
        user_view_steps: [
            'Read the tenant contract already stored in finance.',
            'Generate monthly bill entries for the target month.',
            'Return the bill output and generated ledger entry IDs.'
        ],
        trigger_event: 'finance.billing.monthly.requested',
        trigger_description: 'When scheduled or manual monthly billing must be generated.',
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_generate_bills',
                description: 'Generate bills for the target payer and month.',
                agent: 'FinanceAI',
                tool: 'generate_monthly_bills',
                params: {
                    payer_id: '{{context.payer_id}}',
                    month_year: '{{context.month_year}}',
                    property_id: '{{context.property_id}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_add_ledger_entry_v1',
        name: 'Finance Manual Ledger Debit',
        description: 'Deterministic workflow for append-only debit entries.',
        user_view_title: 'Add Ledger Debit (Plain English)',
        user_view_steps: [
            'Receive approved debit details for a tenant/payer.',
            'Create exactly one new ledger debit entry.',
            'Never modify old entries; keep ledger append-only.'
        ],
        trigger_event: 'finance.ledger.debit.requested',
        trigger_description: 'When an approved manual debit must be added to ledger.',
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_add_ledger_entry',
                description: 'Add a single append-only debit ledger entry.',
                agent: 'FinanceAI',
                tool: 'add_ledger_entry',
                params: {
                    payer_id: '{{context.payer_id}}',
                    category: '{{context.category}}',
                    amount_due: '{{context.amount_due}}',
                    month_year: '{{context.month_year}}',
                    reason: '{{context.reason}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_record_incoming_txn_v1',
        name: 'Finance Incoming Payment Posting',
        description: 'Deterministic workflow for posting incoming payment after CEO confirmation.',
        user_view_title: 'Post Incoming Payment (Plain English)',
        user_view_steps: [
            'Wait for CEO confirmation that payment is visible in bank statement.',
            'Record the incoming payment against payer ID.',
            'Apply waterfall allocation and return allocation summary.'
        ],
        trigger_event: 'finance.payment.incoming.confirmed',
        trigger_description: 'When CEO confirms payment is visible in bank statement.',
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_record_incoming',
                description: 'Post incoming amount and apply waterfall allocation.',
                agent: 'FinanceAI',
                tool: 'record_incoming_txn',
                params: {
                    payer_id: '{{context.payer_id}}',
                    amount: '{{context.amount}}',
                    payment_mode: '{{context.payment_mode}}',
                    date: '{{context.date}}',
                    attachment_url: '{{context.attachment_url}}',
                    txn_id: '{{context.txn_id}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_record_outgoing_txn_v1',
        name: 'Finance Outgoing Expense Posting',
        description: 'Deterministic workflow for recording approved outgoing transactions.',
        user_view_title: 'Record Outgoing Expense (Plain English)',
        user_view_steps: [
            'Receive approved outgoing payment request.',
            'Record one outgoing finance transaction with full context.',
            'Return transaction ID and posting status.'
        ],
        trigger_event: 'finance.payment.outgoing.requested',
        trigger_description: 'When approved outgoing payment must be posted.',
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_record_outgoing',
                description: 'Record outgoing expense transaction in finance ledger.',
                agent: 'FinanceAI',
                tool: 'record_outgoing_txn',
                params: {
                    category: '{{context.category}}',
                    sub_category: '{{context.sub_category}}',
                    work_done: '{{context.work_done}}',
                    property_id: '{{context.property_id}}',
                    amount: '{{context.amount}}',
                    payee: '{{context.payee}}',
                    payment_mode: '{{context.payment_mode}}',
                    approved_by: '{{context.approved_by}}',
                    remarks: '{{context.remarks}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_process_salary_payout_v1',
        name: 'Finance Salary Payout',
        description: 'Deterministic workflow for salary payout posting.',
        user_view_title: 'Process Salary Payout (Plain English)',
        user_view_steps: [
            'Receive approved payroll staff and month context.',
            'Process salary payout through finance logic.',
            'Return paid amount and payout transaction ID.'
        ],
        trigger_event: 'finance.salary.payout.requested',
        trigger_description: 'When salary payout cycle is approved.',
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_salary_payout',
                description: 'Process salary payout for staff and payroll month.',
                agent: 'FinanceAI',
                tool: 'process_salary_payout',
                params: {
                    staff_id: '{{context.staff_id}}',
                    month: '{{context.month}}',
                    year: '{{context.year}}'
                },
                on_failure: 'abort'
            }
        ]
    }
];

const PREDEFINED_FINANCIAL_WORKFLOW_IDS = PREDEFINED_FINANCIAL_WORKFLOWS.map(w => w.workflow_id);

function isProtectedPredefinedWorkflow(workflowId) {
    return PREDEFINED_FINANCIAL_WORKFLOW_IDS.includes(workflowId);
}

function ensurePredefinedFinancialWorkflows(workflowStore) {
    const existing = workflowStore.list();
    const byId = new Map(existing.map(w => [w.workflow_id, w]));
    let changed = false;

    for (const canonical of PREDEFINED_FINANCIAL_WORKFLOWS) {
        const current = byId.get(canonical.workflow_id);
        if (!current) {
            byId.set(canonical.workflow_id, { ...canonical, created_at: TimeAuthorityService.nowIST() });
            changed = true;
            continue;
        }

        const normalized = {
            ...current,
            ...canonical,
            created_at: current.created_at || canonical.created_at || TimeAuthorityService.nowIST(),
            updated_at: TimeAuthorityService.nowIST()
        };
        byId.set(canonical.workflow_id, normalized);
        changed = true;
    }

    if (changed) {
        workflowStore.saveAll(Array.from(byId.values()));
    }
}

module.exports = {
    FINANCIAL_MUTATION_TOOL_TO_WORKFLOW,
    PREDEFINED_FINANCIAL_WORKFLOW_IDS,
    isProtectedPredefinedWorkflow,
    ensurePredefinedFinancialWorkflows
};
