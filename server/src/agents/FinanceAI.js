const BaseAgent = require('./BaseAgent');
const BusinessConfig = require('../config/business');

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
        this.carryForwardCredits = {}; // payer_id -> [{ id, amount_remaining, available_from_key, available_from_month_year, source_txn_id }]

        this.PRIORITY = {};
        BusinessConfig.finance.waterfall_priority.forEach((cat, idx) => {
            this.PRIORITY[cat] = idx + 1;
        });

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
        pending.sort((a, b) => {
            const pA = this.PRIORITY[a.category] || 99;
            const pB = this.PRIORITY[b.category] || 99;
            if (pA !== pB) return pA - pB;

            const dateA = this._parseMonthYear(a.month_year);
            const dateB = this._parseMonthYear(b.month_year);
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

    _parseMonthYear(monthYear) {
        if (!monthYear || typeof monthYear !== 'string') return new Date(0);
        const cleaned = monthYear.trim();
        const parts = cleaned.split(/\s+/);
        if (parts.length < 2) return new Date(0);

        const monthToken = parts[0].toLowerCase();
        const year = Number(parts[1]);

        const monthMap = {
            jan: 0, january: 0,
            feb: 1, february: 1,
            mar: 2, march: 2,
            apr: 3, april: 3,
            may: 4,
            jun: 5, june: 5,
            jul: 6, july: 6,
            aug: 7, august: 7,
            sep: 8, sept: 8, september: 8,
            oct: 9, october: 9,
            nov: 10, november: 10,
            dec: 11, december: 11
        };

        const monthIndex = monthMap[monthToken];
        if (!Number.isFinite(year) || monthIndex === undefined) return new Date(0);
        return new Date(year, monthIndex, 1);
    }

    _monthKeyFromDate(date) {
        return (date.getFullYear() * 12) + date.getMonth();
    }

    _toShortMonthYear(date) {
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[date.getMonth()]} ${date.getFullYear()}`;
    }

    _addCarryForwardCredit({ payer_id, amount, sourceDate, sourceTxnId }) {
        if (!(amount > 0)) return null;

        const baseDate = sourceDate instanceof Date && !Number.isNaN(sourceDate.getTime())
            ? sourceDate
            : new Date();
        const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        const credit = {
            id: `CF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount_remaining: amount,
            available_from_key: this._monthKeyFromDate(nextMonthDate),
            available_from_month_year: this._toShortMonthYear(nextMonthDate),
            source_txn_id: sourceTxnId
        };

        if (!this.carryForwardCredits[payer_id]) this.carryForwardCredits[payer_id] = [];
        this.carryForwardCredits[payer_id].push(credit);
        return credit;
    }

    _consumeCarryForwardCredits(payer_id, billMonthKey, neededAmount) {
        const credits = this.carryForwardCredits[payer_id] || [];
        if (!(neededAmount > 0) || credits.length === 0) return { consumed: 0, credit_sources: [] };

        const eligible = credits
            .filter(c => c.amount_remaining > 0 && c.available_from_key <= billMonthKey)
            .sort((a, b) => a.available_from_key - b.available_from_key);

        let remaining = neededAmount;
        const credit_sources = [];

        for (const credit of eligible) {
            if (remaining <= 0) break;
            const use = Math.min(remaining, credit.amount_remaining);
            credit.amount_remaining -= use;
            remaining -= use;
            credit_sources.push({ credit_id: credit.id, amount: use, source_txn_id: credit.source_txn_id });
        }

        return { consumed: neededAmount - remaining, credit_sources };
    }

    _applyCarryForwardToGeneratedEntries(payer_id, month_year, generated_entry_ids) {
        if (!Array.isArray(generated_entry_ids) || generated_entry_ids.length === 0) {
            return { amount: 0, allocations: [], credit_sources: [] };
        }

        const billDate = this._parseMonthYear(month_year);
        const billMonthKey = this._monthKeyFromDate(billDate);

        const targets = this.ledgerEntries
            .filter(e => generated_entry_ids.includes(e.id) && e.balance > 0)
            .sort((a, b) => {
                const pA = this.PRIORITY[a.category] || 99;
                const pB = this.PRIORITY[b.category] || 99;
                if (pA !== pB) return pA - pB;
                return String(a.id).localeCompare(String(b.id));
            });

        const totalOutstanding = targets.reduce((sum, e) => sum + e.balance, 0);
        const { consumed, credit_sources } = this._consumeCarryForwardCredits(payer_id, billMonthKey, totalOutstanding);

        let remainingCredit = consumed;
        const allocations = [];

        for (const entry of targets) {
            if (remainingCredit <= 0) break;
            const applied = Math.min(remainingCredit, entry.balance);
            entry.amount_paid += applied;
            entry.balance -= applied;
            entry.status = entry.balance === 0 ? 'PAID' : 'PARTIALLY_PAID';
            allocations.push({
                ledger_entry_id: entry.id,
                category: entry.category,
                amount_applied: applied
            });
            remainingCredit -= applied;
        }

        return { amount: consumed, allocations, credit_sources };
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

            let carryForward = null;
            if (surplus > 0) {
                const sourceDate = args.date ? new Date(args.date) : new Date(txn.timestamp);
                const credit = this._addCarryForwardCredit({
                    payer_id: args.payer_id,
                    amount: surplus,
                    sourceDate,
                    sourceTxnId: txn.txn_id
                });
                if (credit) {
                    carryForward = {
                        amount: surplus,
                        available_from: credit.available_from_month_year,
                        credit_id: credit.id
                    };
                }
            }

            this.transactions.push(txn);

            return { status: 'SUCCESS', txn_id: txn.txn_id, allocations, surplus, carry_forward: carryForward };
        });

        this.registerTool('get_txn_details', 'View details of a transaction', {
            type: 'object',
            properties: { txn_id: { type: 'string' } },
            required: ['txn_id']
        }, async ({ txn_id }) => {
            const txn = this.transactions.find(t => t.txn_id === txn_id);
            return txn || { status: 'ERROR', message: 'Not found' };
        });

        this.registerTool('get_incoming_txns', 'List incoming transactions', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                limit: { type: 'number' }
            }
        }, async ({ payer_id, limit } = {}) => {
            let list = this.transactions.filter(t => t.type === 'INCOMING');
            if (payer_id) list = list.filter(t => t.payer_id === payer_id);
            list.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
            return { transactions: list.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
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

        this.registerTool('get_expenses', 'List outgoing expense transactions', {
            type: 'object',
            properties: {
                category: { type: 'string' },
                payee: { type: 'string' },
                limit: { type: 'number' }
            }
        }, async ({ category, payee, limit } = {}) => {
            let list = this.transactions.filter(t => t.type === 'OUTGOING');
            if (category) list = list.filter(t => t.category === category);
            if (payee) list = list.filter(t => String(t.payee || '').toLowerCase().includes(String(payee).toLowerCase()));
            list.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
            return { transactions: list.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
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
            const carryForwardApplied = this._applyCarryForwardToGeneratedEntries(args.payer_id, args.month_year, created);

            return {
                status: 'SUCCESS',
                bill_link,
                generated_entries: created,
                applied_carry_forward: carryForwardApplied
            };
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
            // Fetch salary config from BusinessConfig defaults (or HR card if available)
            const base_salary = BusinessConfig.finance.default_base_salary;
            const incentives = BusinessConfig.finance.default_incentive_per_unit;
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

    getOperatingInstructions() {
        const rates = BusinessConfig.rates;
        return `## FinanceAI — Operating Instructions
- **Payer ID**: Always use the tenant's \`lead_id\` in E.164 format (e.g., "+919800098000"). Never use names.
- **Deposit Rules**: Base deposit is ₹${rates.base_security_deposit}. For move-in dates on the ${rates.deposit_rules.dynamic_range_start}th-${rates.deposit_rules.dynamic_range_end}th: Standard + (daily_rent × ${rates.deposit_rules.dynamic_multiplier_days}).
- **Waterfall Priority**: Incoming payments are auto-allocated in this order: ${BusinessConfig.finance.waterfall_priority.join(' → ')}.
- **Contracts**: Before generating bills, a tenant must have a negotiated rate card via \`onboard_tenant_contract\`. If not present, ask the CEO to set it up.
- **Ledger**: The ledger is append-only. Use \`get_ledger\` to check a tenant's current balance. Never manually adjust paid amounts.
- **Bills**: Use \`generate_monthly_bills\` with \`payer_id\` and \`month_year\` (e.g., "Mar 2026").`;
    }
}

module.exports = FinanceAI;
