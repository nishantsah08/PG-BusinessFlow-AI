const BaseAgent = require('./BaseAgent');

/**
 * Finance AI (CFO)
 * Responsible for financial integrity, ledger management, and contract enforcement.
 */
class FinanceAI extends BaseAgent {
    constructor() {
        super({
            name: 'FinanceAI',
            identity: {
                role: 'Chief Financial Officer (Guardian of the Ledger)',
                description: 'The guardian of the ledger. Blind to non-financial details. Strictly enforces negotiated contracts.'
            },
            capabilities: {
                skills: ['Accounting', 'Waterfall Allocation', 'Payroll Calculation', 'Financial Reporting'],
                tools: [
                    'record_incoming_txn', 'get_txn_details', 'get_incoming_txns',
                    'record_outgoing_txn', 'get_expenses',
                    'get_ledger', 'add_ledger_entry', 'generate_monthly_bills', 'onboard_tenant_contract', 'get_tenant_statement',
                    'process_salary_payout', 'record_salary_advance',
                    'get_financial_summary', 'get_defaulters_list'
                ]
            },
            directives: {
                goals: ['Maintain accurate ledger', 'Ensure payment waterfall compliance', 'Enforce negotiated rates'],
                constraints: [
                    'Surety Rule: No updates without certainty',
                    'Delegated Execution: Uses sub-agents (logic blocks) for work',
                    'Append-only ledger'
                ]
            }
        });

        // In-memory simulation of Firestore
        this.ledgerEntries = [];
        this.transactions = [];
        this.contracts = {};     // lead_id -> Negotiated Rate Card
        this.salaryCards = {};   // staff_id -> Salary Card (Mocked handover from HR)

        this.PRIORITY = {
            'Security Deposit': 1,
            'Past Dues': 2,
            'Police Verification Fee': 3,
            'Rent': 4,
            'Parking Fee': 5,
            'Wi-Fi Fee': 6,
            'Electricity Bill': 7,
            'Asset Damage Recovery': 8,
            'Late Payment Fees': 9
        };

        this.registerTools();
    }

    // --- Helper Logic (Sub-Agent Delegations) ---

    _calculateWaterfall(payer_id, amount) {
        let remaining = amount;
        const allocations = [];

        // Filter valid entries for allocation
        const pending = this.ledgerEntries.filter(e =>
            e.payer_id === payer_id && e.status !== 'PAID'
        );

        // Sort by Priority then by month_year (oldest first)
        const parseMonthYear = (my) => {
            if (!my) return new Date(0);
            const [m, y] = my.split(' ');
            const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
            return new Date(y, months[m] || 0);
        };

        pending.sort((a, b) => {
            const pA = this.PRIORITY[a.category] || 99;
            const pB = this.PRIORITY[b.category] || 99;
            if (pA !== pB) return pA - pB;

            const dateA = parseMonthYear(a.month_year);
            const dateB = parseMonthYear(b.month_year);
            return dateA - dateB;
        });

        for (const entry of pending) {
            if (remaining <= 0) break;
            const pay = Math.min(remaining, entry.balance);

            entry.amount_paid += pay;
            entry.balance -= pay;
            entry.status = entry.balance === 0 ? 'PAID' : 'PARTIALLY_PAID';

            allocations.push({
                ledger_entry_id: entry.id,
                category: entry.category,
                amount_allocated: pay
            });
            remaining -= pay;
        }

        return { allocations, surplus: remaining };
    }

    // --- Tool Implementations ---

    registerTools() {
        // --- 1. Revenue & Collections ---

        this.registerTool('record_incoming_txn', 'Allocate and record an incoming payment', {
            type: 'object',
            properties: {
                amount: { type: 'number' },
                payer_id: { type: 'string' },
                payment_mode: { type: 'string' },
                date: { type: 'string' },
                attachment_url: { type: 'string' },
                txn_id: { type: 'string' },
                force_unsure: { type: 'boolean' } // For testing SAF-01
            },
            required: ['amount', 'payer_id']
        }, async (args) => {
            if (args.force_unsure) return { status: 'REJECTED', reason: 'Surety validation failed (Unsure state simulated)' };
            if (args.amount < 0) return { status: 'REJECTED', reason: 'Amount cannot be negative' };
            if (args.txn_id && this.transactions.find(t => t.txn_id === args.txn_id)) {
                return { status: 'REJECTED', reason: `Transaction ID ${args.txn_id} already exists` };
            }

            const { allocations, surplus } = this._calculateWaterfall(args.payer_id, args.amount);

            const txn = {
                txn_id: args.txn_id || `IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                type: 'INCOMING',
                ...args,
                allocations,
                unallocated_surplus: surplus,
                timestamp: new Date().toISOString()
            };
            this.transactions.push(txn);

            return { status: 'SUCCESS', txn_id: txn.txn_id, allocations, surplus };
        });

        this.registerTool('get_txn_details', 'View details of a transaction', {
            type: 'object',
            properties: { txn_id: { type: 'string' } },
            required: ['txn_id']
        }, async ({ txn_id }) => {
            const txn = this.transactions.find(t => t.txn_id === txn_id);
            return txn || { status: 'ERROR', message: 'Not found' };
        });

        // --- 2. Expenses ---

        this.registerTool('record_outgoing_txn', 'Record an office or property expense', {
            type: 'object',
            properties: {
                category: { type: 'string', enum: ['OpEx', 'CapEx'] },
                sub_category: { type: 'string' },
                work_done: { type: 'string' },
                property_id: { type: 'string' },
                amount: { type: 'number' },
                payee: { type: 'string' },
                payment_mode: { type: 'string' },
                approved_by: { type: 'string' },
                remarks: { type: 'string' }
            },
            required: ['category', 'amount', 'payee']
        }, async (args) => {
            const txn = {
                txn_id: `OUT-${Date.now()}`,
                type: 'OUTGOING',
                ...args,
                timestamp: new Date().toISOString()
            };
            this.transactions.push(txn);
            return { status: 'SUCCESS', txn_id: txn.txn_id };
        });

        // --- 3. Ledger & Billing ---

        this.registerTool('onboard_tenant_contract', 'Register negotiated rates for a tenant', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                negotiated_rent: { type: 'number' },
                security_deposit: { type: 'number' },
                rent_payment_timing: { type: 'string', enum: ['ADVANCE', 'ARREARS'] },
                utility_payment_timing: { type: 'string', enum: ['ADVANCE', 'ARREARS'] },
                effective_from: { type: 'string' }
            },
            required: ['lead_id', 'negotiated_rent']
        }, async (args) => {
            this.contracts[args.lead_id] = args;
            return { status: 'SUCCESS', message: 'Contract negotiated and stored' };
        });

        this.registerTool('generate_monthly_bills', 'Billing Agent: Generate monthly debits', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                month_year: { type: 'string' },
                property_id: { type: 'string' }
            },
            required: ['payer_id', 'month_year']
        }, async (args) => {
            const contract = this.contracts[args.payer_id];
            if (!contract) return { status: 'ERROR', message: 'No negotiated contract found for this tenant' };

            const items = [
                { category: 'Rent', amount: contract.negotiated_rent }
                // Utility logic (meter delta) would be added here in a real scenario
            ];

            const created = [];
            for (const item of items) {
                const entry = {
                    id: `LED-${this.ledgerEntries.length + 1}`,
                    payer_id: args.payer_id,
                    category: item.category,
                    month_year: args.month_year,
                    amount_due: item.amount,
                    amount_paid: 0,
                    balance: item.amount,
                    status: 'PENDING',
                    created_at: new Date().toISOString()
                };
                this.ledgerEntries.push(entry);
                created.push(entry.id);
            }

            // Simulate PDF Link generation
            const bill_link = `https://storage.googleapis.com/bills/${args.payer_id}_${args.month_year.replace(' ', '_')}.pdf`;

            return { status: 'SUCCESS', bill_link, generated_entries: created };
        });

        this.registerTool('get_ledger', 'View ledger for a payer', {
            type: 'object',
            properties: { payer_id: { type: 'string' } },
            required: ['payer_id']
        }, async ({ payer_id }) => {
            const entries = this.ledgerEntries.filter(e => e.payer_id === payer_id);
            return { payer_id, entries };
        });

        this.registerTool('add_ledger_entry', 'Manually add a debit entry', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                category: { type: 'string' },
                amount_due: { type: 'number' },
                month_year: { type: 'string' },
                reason: { type: 'string' }
            },
            required: ['payer_id', 'category', 'amount_due']
        }, async (args) => {
            const entry = {
                id: `LED-${this.ledgerEntries.length + 1}`,
                ...args,
                amount_paid: 0,
                balance: args.amount_due,
                status: 'PENDING',
                created_at: new Date().toISOString()
            };
            this.ledgerEntries.push(entry);
            return { status: 'SUCCESS', entry_id: entry.id };
        });

        // --- 4. Salaries ---

        this.registerTool('process_salary_payout', 'Salary Agent: Finalize monthly payout', {
            type: 'object',
            properties: { staff_id: { type: 'string' }, month: { type: 'string' }, year: { type: 'string' } },
            required: ['staff_id']
        }, async (args) => {
            // Mock: Fetching salary card from HR logic
            const base_salary = 4000;
            const incentives = 350; // Simple mock
            const advances = 0;
            const total = base_salary + incentives - advances;

            const txn = {
                txn_id: `PAY-${args.staff_id}-${Date.now()}`,
                type: 'SALARY_PAYOUT',
                staff_id: args.staff_id,
                amount: total,
                timestamp: new Date().toISOString()
            };
            this.transactions.push(txn);
            return { status: 'SUCCESS', amount_paid: total, txn_id: txn.txn_id };
        });

        // --- 5. Analytics ---

        this.registerTool('get_financial_summary', 'Get total inflow/outflow', {
            type: 'object',
            properties: { date_range: { type: 'string' } }
        }, async () => {
            const inflow = this.transactions.filter(t => t.type === 'INCOMING').reduce((a, b) => a + b.amount, 0);
            const outflow = this.transactions.filter(t => t.type === 'OUTGOING' || t.type === 'SALARY_PAYOUT').reduce((a, b) => a + b.amount, 0);
            const outstanding = this.ledgerEntries.reduce((a, b) => a + b.balance, 0);

            return { total_inflow: inflow, total_outflow: outflow, total_outstanding: outstanding };
        });

        this.registerTool('get_defaulters_list', 'List tenants with pending dues', {
            type: 'object',
            properties: { limit: { type: 'number' } }
        }, async () => {
            const defaulters = {};
            this.ledgerEntries.filter(e => e.status !== 'PAID').forEach(e => {
                defaulters[e.payer_id] = (defaulters[e.payer_id] || 0) + e.balance;
            });
            return Object.entries(defaulters).map(([id, bal]) => ({ payer_id: id, total_due: bal }));
        });
    }
}

module.exports = FinanceAI;
