const BaseAgent = require('./BaseAgent');

class FinanceAI extends BaseAgent {
    constructor() {
        super({
            name: 'FinanceAI',
            identity: {
                role: 'Guardian of the Ledger',
                description: 'Manages all money in/out. Enforces strict allocation rules.'
            },
            capabilities: {
                skills: ['Accounting', 'Waterfall Allocation'],
                tools: ['record_incoming_txn', 'record_outgoing_txn', 'generate_monthly_bills']
            },
            directives: {
                goals: ['Accurate Ledger', 'Prioritize Recovery'],
                constraints: ['Append-only ledger']
            }
        });

        // In-memory data
        this.ledgerEntries = []; // The "Bills" or "Debts"
        this.transactions = [];  // The "Cash Flow"

        // Priority Map for Waterfall
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

    registerTools() {
        // generate_monthly_bills (Billing Sub-Agent Logic)
        this.registerTool('generate_monthly_bills', 'Create ledger entries for a user', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                month_year: { type: 'string' }, // e.g. "Jan 2024"
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            category: { type: 'string' },
                            amount: { type: 'number' }
                        }
                    }
                }
            },
            required: ['payer_id', 'items']
        }, async (args) => {
            const addedEntries = [];
            for (const item of args.items) {
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
                addedEntries.push(entry.id);
            }
            return { status: "Bills Generated", count: addedEntries.length, entries: addedEntries };
        });

        // record_incoming_txn (Waterfall Logic)
        this.registerTool('record_incoming_txn', 'Record payment & allocate', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                amount: { type: 'number' },
                mode: { type: 'string' },
                txn_id: { type: 'string' }
            },
            required: ['payer_id', 'amount']
        }, async (args) => {
            let remainingAmount = args.amount;
            const allocations = [];

            // 1. Get all pending/partial entries for user
            const pending = this.ledgerEntries.filter(e =>
                e.payer_id === args.payer_id &&
                e.status !== 'PAID'
            );

            // 2. Sort by Priority
            pending.sort((a, b) => {
                const pA = this.PRIORITY[a.category] || 99;
                const pB = this.PRIORITY[b.category] || 99;
                return pA - pB;
            });

            // 3. Allocate
            for (const entry of pending) {
                if (remainingAmount <= 0) break;

                const needed = entry.balance;
                const pay = Math.min(remainingAmount, needed);

                // Update Entry
                entry.amount_paid += pay;
                entry.balance -= pay;
                if (entry.balance === 0) entry.status = 'PAID';
                else entry.status = 'PARTIALLY_PAID';

                // Record Allocation
                allocations.push({
                    ledger_entry_id: entry.id,
                    category: entry.category,
                    amount_allocated: pay
                });

                remainingAmount -= pay;
            }

            // 4. Save Main Transaction
            const txn = {
                txn_id: args.txn_id || `IN-${this.transactions.length + 1}`,
                type: 'INCOMING',
                ...args,
                allocations: allocations,
                unallocated_surplus: remainingAmount, // If any money left
                date: new Date().toISOString()
            };
            this.transactions.push(txn);

            return {
                status: "Payment Recorded",
                txn_id: txn.txn_id,
                allocations: allocations,
                surplus: remainingAmount
            };
        });

        // record_outgoing_txn
        this.registerTool('record_outgoing_txn', 'Record expense', {
            type: 'object',
            properties: {
                amount: { type: 'number' },
                category: { type: 'string' },
                payee: { type: 'string' },
                remarks: { type: 'string' }
            },
            required: ['amount', 'category']
        }, async (args) => {
            const txn = {
                txn_id: `OUT-${this.transactions.length + 1}`,
                type: 'OUTGOING',
                ...args,
                date: new Date().toISOString()
            };
            this.transactions.push(txn);
            return { status: "Expense Recorded", txn_id: txn.txn_id };
        });
    }
}

module.exports = FinanceAI;
