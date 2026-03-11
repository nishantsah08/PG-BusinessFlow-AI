const BaseAgent = require('./BaseAgent');
const BusinessConfig = require('../config/business');
const TenantDataStore = require('../storage/TenantDataStore');

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

        this.defaultTenantId = BusinessConfig.DEFAULT_TENANT_ID || 'default';
        this.dataBackend = process.env.STORAGE_BACKEND || (process.env.NODE_ENV === 'test' ? 'memory' : 'local');
        this._activeTenantId = null;
        this._tenantStates = new Map();
        this._tenantStores = new Map();
        this._namespaceStores = new Map();
        this._businessConfigProvider = (tenantId) => {
            if (typeof BusinessConfig.getBusinessConfig === 'function') {
                return BusinessConfig.getBusinessConfig(tenantId);
            }
            return BusinessConfig;
        };

        this.PRIORITY = {};
        this._businessConfigProvider(this.defaultTenantId).finance.waterfall_priority.forEach((cat, idx) => {
            this.PRIORITY[cat] = idx + 1;
        });

        this.registerTools();
    }

    // --- Helper Logic (Sub-Agent Delegations) ---

    _extractTenantId(args = {}) {
        return args.tenant_id || this.defaultTenantId;
    }

    _getTenantStore(tenantId) {
        if (!this._tenantStores.has(tenantId)) {
            this._tenantStores.set(
                tenantId,
                new TenantDataStore({
                    tenantId,
                    namespace: 'finance',
                    backend: this.dataBackend
                })
            );
        }
        return this._tenantStores.get(tenantId);
    }

    _getNamespaceStore(tenantId, namespace) {
        const key = `${tenantId || this.defaultTenantId}::${namespace}`;
        if (!this._namespaceStores.has(key)) {
            this._namespaceStores.set(
                key,
                new TenantDataStore({
                    tenantId: tenantId || this.defaultTenantId,
                    namespace,
                    backend: this.dataBackend
                })
            );
        }
        return this._namespaceStores.get(key);
    }

    _hydrateState(rawState) {
        const safe = rawState || {};
        return {
            ledgerEntries: Array.isArray(safe.ledgerEntries) ? safe.ledgerEntries : [],
            transactions: Array.isArray(safe.transactions) ? safe.transactions : [],
            contracts: safe.contracts && typeof safe.contracts === 'object' ? safe.contracts : {},
            salaryCards: safe.salaryCards && typeof safe.salaryCards === 'object' ? safe.salaryCards : {},
            carryForwardCredits: safe.carryForwardCredits && typeof safe.carryForwardCredits === 'object'
                ? safe.carryForwardCredits
                : {}
        };
    }

    _getState(tenantId = this.defaultTenantId) {
        const resolvedTenantId = tenantId || this.defaultTenantId;
        if (!this._tenantStates.has(resolvedTenantId)) {
            const store = this._getTenantStore(resolvedTenantId);
            const rawState = store.load({
                ledgerEntries: [],
                transactions: [],
                contracts: {},
                salaryCards: {},
                carryForwardCredits: {}
            });

            this._tenantStates.set(resolvedTenantId, this._hydrateState(rawState));
        }

        return this._tenantStates.get(resolvedTenantId);
    }

    _saveState(tenantId) {
        const resolvedTenantId = tenantId || this.defaultTenantId;
        const state = this._getState(resolvedTenantId);
        this._getTenantStore(resolvedTenantId).save({
            ...state,
            lastUpdatedAt: new Date().toISOString(),
            businessConfig: this._businessConfigProvider(resolvedTenantId)
        });
    }

    _setTenantContext(tenantId) {
        const previousTenantId = this._activeTenantId;
        this._activeTenantId = tenantId || this.defaultTenantId;
        this._getState(this._activeTenantId);
        return previousTenantId;
    }

    _getActiveBusinessConfig(tenantId = this.defaultTenantId) {
        return this._businessConfigProvider(tenantId) || this._businessConfigProvider(this.defaultTenantId);
    }

    _getPriorityIndex(category, tenantId = this._activeTenantId) {
        const config = this._getActiveBusinessConfig(tenantId);
        const priorities = Array.isArray(config?.finance?.waterfall_priority) ? config.finance.waterfall_priority : [];
        const idx = priorities.indexOf(category);
        return idx >= 0 ? idx + 1 : 99;
    }

    get ledgerEntries() {
        return this._getState(this._activeTenantId).ledgerEntries;
    }

    set ledgerEntries(value) {
        this._getState(this._activeTenantId).ledgerEntries = value;
    }

    get transactions() {
        return this._getState(this._activeTenantId).transactions;
    }

    set transactions(value) {
        this._getState(this._activeTenantId).transactions = value;
    }

    get contracts() {
        return this._getState(this._activeTenantId).contracts;
    }

    set contracts(value) {
        this._getState(this._activeTenantId).contracts = value;
    }

    get salaryCards() {
        return this._getState(this._activeTenantId).salaryCards;
    }

    set salaryCards(value) {
        this._getState(this._activeTenantId).salaryCards = value;
    }

    get carryForwardCredits() {
        return this._getState(this._activeTenantId).carryForwardCredits;
    }

    set carryForwardCredits(value) {
        this._getState(this._activeTenantId).carryForwardCredits = value;
    }

    _calculateWaterfall(payer_id, amount, tenantId = this._activeTenantId) {
        let remaining = amount;
        const allocations = [];

        // Filter valid entries for allocation
        const pending = this.ledgerEntries.filter(e =>
            e.payer_id === payer_id && e.status !== 'PAID'
        );

        // Sort by Priority then by month_year (oldest first)
        pending.sort((a, b) => {
            const pA = this._getPriorityIndex(a.category, tenantId);
            const pB = this._getPriorityIndex(b.category, tenantId);
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

    _loadHrState(tenantId = this._activeTenantId) {
        return this._getNamespaceStore(tenantId, 'hr').load({
            staff: [],
            salary_cards: [],
            leaves: [],
            caretaker_activity: []
        });
    }

    _loadPropertyState(tenantId = this._activeTenantId) {
        return this._getNamespaceStore(tenantId, 'property').load({
            properties: [],
            units: [],
            meters: [],
            maintenance_requests: []
        });
    }

    _getSalaryCard(staffId, tenantId = this._activeTenantId) {
        const hrState = this._loadHrState(tenantId);
        const hrCard = Array.isArray(hrState.salary_cards)
            ? hrState.salary_cards.find((card) => card.staff_id === staffId)
            : null;
        if (hrCard) return hrCard;
        return this.salaryCards[staffId] || null;
    }

    _getStaffMember(staffId, tenantId = this._activeTenantId) {
        const hrState = this._loadHrState(tenantId);
        return Array.isArray(hrState.staff)
            ? hrState.staff.find((staff) => staff.id === staffId) || null
            : null;
    }

    _normalizeMonthIndex(month) {
        if (typeof month === 'number' && Number.isFinite(month)) {
            if (month >= 1 && month <= 12) return month - 1;
            if (month >= 0 && month <= 11) return month;
        }

        if (typeof month === 'string') {
            const cleaned = month.trim().toLowerCase();
            if (/^\d+$/.test(cleaned)) {
                const numeric = Number(cleaned);
                if (numeric >= 1 && numeric <= 12) return numeric - 1;
            }
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
            if (monthMap[cleaned] !== undefined) return monthMap[cleaned];
        }

        return new Date().getMonth();
    }

    _getLastSaturday(year, monthIndex) {
        const cursor = new Date(year, monthIndex + 1, 0);
        while (cursor.getDay() !== 6) {
            cursor.setDate(cursor.getDate() - 1);
        }
        cursor.setHours(23, 59, 59, 999);
        return cursor;
    }

    _resolvePayrollWindow(month, year) {
        const resolvedYear = Number(year) || new Date().getFullYear();
        const resolvedMonthIndex = this._normalizeMonthIndex(month);
        const windowEnd = this._getLastSaturday(resolvedYear, resolvedMonthIndex);
        const previousMonthIndex = resolvedMonthIndex === 0 ? 11 : resolvedMonthIndex - 1;
        const previousMonthYear = resolvedMonthIndex === 0 ? resolvedYear - 1 : resolvedYear;
        const previousLastSaturday = this._getLastSaturday(previousMonthYear, previousMonthIndex);
        const windowStart = new Date(previousLastSaturday);
        windowStart.setHours(0, 0, 0, 0);
        windowStart.setDate(windowStart.getDate() + 1);

        return {
            windowStart,
            windowEnd,
            salaryMonthLabel: this._toShortMonthYear(new Date(resolvedYear, resolvedMonthIndex, 1))
        };
    }

    _isDateWithinRange(value, startDate, endDate) {
        const ts = new Date(value).getTime();
        return Number.isFinite(ts) && ts >= startDate.getTime() && ts <= endDate.getTime();
    }

    _toDateKey(value) {
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return null;
        return dt.toISOString().slice(0, 10);
    }

    _getRollingWeekKey(value, windowStart) {
        const ts = new Date(value).getTime();
        if (!Number.isFinite(ts)) return null;
        const diff = Math.max(0, ts - windowStart.getTime());
        return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
    }

    _getUnitOccupantAtWindowEnd(unit, windowEnd) {
        const history = Array.isArray(unit.history) ? [...unit.history] : [];
        history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let currentState = 'AVAILABLE';
        let currentTenant = null;
        history.forEach((entry) => {
            const entryTs = new Date(entry.date).getTime();
            if (!Number.isFinite(entryTs) || entryTs > windowEnd.getTime()) return;
            if (entry.state === 'BOOKED') {
                currentState = 'BOOKED';
                currentTenant = entry.tenant || currentTenant;
                return;
            }
            if (entry.state === 'NOTICE') {
                currentState = 'NOTICE';
                currentTenant = entry.tenant || currentTenant;
                return;
            }
            if (entry.state === 'AVAILABLE') {
                currentState = 'AVAILABLE';
                currentTenant = null;
            }
        });

        if ((currentState === 'BOOKED' || currentState === 'NOTICE') && currentTenant) {
            return currentTenant;
        }
        if ((unit.status === 'BOOKED' || unit.status === 'NOTICE') && unit.tenant_id) {
            return unit.tenant_id;
        }
        return null;
    }

    _hasFullRentPaymentForMonth(payerId, monthLabel) {
        const rentEntries = this.ledgerEntries.filter((entry) => (
            entry.payer_id === payerId
            && entry.category === 'Rent'
            && entry.month_year === monthLabel
        ));

        if (rentEntries.length === 0) return false;
        return rentEntries.every((entry) => Number(entry.balance || 0) <= 0 || entry.status === 'PAID');
    }

    _calculateCaretakerCompensation(staffId, month, year, tenantId = this._activeTenantId) {
        const config = this._getActiveBusinessConfig(tenantId);
        const compensationCfg = config.finance?.caretaker_compensation || {};
        const hrState = this._loadHrState(tenantId);
        const propertyState = this._loadPropertyState(tenantId);
        const salaryCard = this._getSalaryCard(staffId, tenantId) || {};
        const payrollWindow = this._resolvePayrollWindow(month, year);

        const baseSalary = Number(salaryCard.base_salary)
            || Number(compensationCfg.fixed_basic_salary)
            || Number(config.finance?.default_base_salary)
            || 4000;

        const assignedUnits = (Array.isArray(propertyState.units) ? propertyState.units : [])
            .filter((unit) => unit.status !== 'DELETED' && unit.caretaker_staff_id === staffId);

        const fullyPaidOccupiedUnits = assignedUnits.filter((unit) => {
            const occupant = this._getUnitOccupantAtWindowEnd(unit, payrollWindow.windowEnd);
            if (!occupant) return false;
            return this._hasFullRentPaymentForMonth(occupant, payrollWindow.salaryMonthLabel);
        }).length;

        const activityLogs = (Array.isArray(hrState.caretaker_activity) ? hrState.caretaker_activity : [])
            .filter((entry) => entry.staff_id === staffId && this._isDateWithinRange(entry.occurred_at, payrollWindow.windowStart, payrollWindow.windowEnd));

        const dailyCleaningDays = new Set(
            activityLogs
                .filter((entry) => entry.activity_type === 'DAILY_CLEANING')
                .map((entry) => this._toDateKey(entry.occurred_at))
                .filter(Boolean)
        ).size;

        const parkingCleaningWeeks = new Set(
            activityLogs
                .filter((entry) => entry.activity_type === 'PARKING_CLEANING')
                .map((entry) => this._getRollingWeekKey(entry.occurred_at, payrollWindow.windowStart))
                .filter((value) => value !== null)
        ).size;

        const maintenanceComplaints = (Array.isArray(propertyState.maintenance_requests) ? propertyState.maintenance_requests : [])
            .filter((ticket) => (
                ticket.assigned_caretaker_staff_id === staffId
                && this._isDateWithinRange(ticket.created_at, payrollWindow.windowStart, payrollWindow.windowEnd)
            ))
            .length;

        const unitsPaidAmount = fullyPaidOccupiedUnits * (Number(compensationCfg.per_fully_paid_occupied_unit) || 250);
        const dailyCleaningAmount = dailyCleaningDays * (Number(compensationCfg.daily_cleaning_proof_amount) || 100);
        const parkingCleaningAmount = parkingCleaningWeeks * (Number(compensationCfg.weekly_parking_cleaning_amount) || 100);
        const complaintDeductionAmount = maintenanceComplaints * (Number(compensationCfg.maintenance_complaint_deduction) || 100);

        return {
            payroll_window: {
                from: payrollWindow.windowStart.toISOString(),
                to: payrollWindow.windowEnd.toISOString()
            },
            base_salary: baseSalary,
            fully_paid_occupied_units: fullyPaidOccupiedUnits,
            unit_incentive_amount: unitsPaidAmount,
            daily_cleaning_days: dailyCleaningDays,
            daily_cleaning_amount: dailyCleaningAmount,
            parking_cleaning_weeks: parkingCleaningWeeks,
            parking_cleaning_amount: parkingCleaningAmount,
            maintenance_complaints: maintenanceComplaints,
            complaint_deduction_amount: complaintDeductionAmount,
            total_salary: baseSalary + unitsPaidAmount + dailyCleaningAmount + parkingCleaningAmount - complaintDeductionAmount
        };
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

        const currentTenantId = this._activeTenantId || tenantId;
        const targets = this.ledgerEntries
            .filter(e => generated_entry_ids.includes(e.id) && e.balance > 0)
            .sort((a, b) => {
            const pA = this._getPriorityIndex(a.category, currentTenantId);
            const pB = this._getPriorityIndex(b.category, currentTenantId);
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
            const staffMember = this._getStaffMember(args.staff_id, this._activeTenantId);
            const salaryCard = this._getSalaryCard(args.staff_id, this._activeTenantId) || {};
            const isCaretaker = String(staffMember?.designation || '').toLowerCase().includes('caretaker')
                || salaryCard?.components?.compensation_model === 'CARETAKER_UNIT_BASED';

            let payoutBreakdown;
            let total;

            if (isCaretaker) {
                payoutBreakdown = this._calculateCaretakerCompensation(args.staff_id, args.month, args.year, this._activeTenantId);
                total = payoutBreakdown.total_salary;
            } else {
                const config = this._getActiveBusinessConfig(this._activeTenantId);
                const baseSalary = Number(salaryCard.base_salary)
                    || Number(config.finance?.default_base_salary)
                    || 4000;
                const incentives = Number(salaryCard?.components?.incentives?.amount_per_unit)
                    || Number(config.finance?.default_incentive_per_unit)
                    || 0;
                const advances = 0;
                total = baseSalary + incentives - advances;
                payoutBreakdown = {
                    base_salary: baseSalary,
                    fixed_incentive_amount: incentives,
                    advances,
                    total_salary: total
                };
            }

            const txn = {
                txn_id: `PAY-${args.staff_id}-${Date.now()}`,
                type: 'SALARY_PAYOUT',
                staff_id: args.staff_id,
                amount: total,
                month: args.month || null,
                year: args.year || null,
                breakdown: payoutBreakdown,
                timestamp: new Date().toISOString()
            };
            this.transactions.push(txn);
            return {
                status: 'SUCCESS',
                amount_paid: total,
                txn_id: txn.txn_id,
                salary_slip: {
                    staff_id: args.staff_id,
                    staff_name: staffMember?.name || null,
                    designation: staffMember?.designation || null,
                    month: args.month || null,
                    year: args.year || null,
                    breakdown: payoutBreakdown
                }
            };
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

    async callTool(name, args = {}) {
        const tenantId = this._extractTenantId(args);
        const normalizedArgs = { ...args, tenant_id: args.tenant_id || tenantId };
        const previousTenantId = this._setTenantContext(tenantId);

        try {
            const result = await super.callTool(name, normalizedArgs);
            this._saveState(tenantId);
            return result;
        } finally {
            this._activeTenantId = previousTenantId;
        }
    }

    getOperatingInstructions() {
        const rates = this._getActiveBusinessConfig(this._activeTenantId).rates;
        return `## FinanceAI — Operating Instructions
- **Payer ID**: Always use the tenant's \`lead_id\` in E.164 format (e.g., "+919800098000"). Never use names.
- **Deposit Rules**: Base deposit is ₹${rates.base_security_deposit}. For move-in dates on the ${rates.deposit_rules.dynamic_range_start}th-${rates.deposit_rules.dynamic_range_end}th: Standard + (daily_rent × ${rates.deposit_rules.dynamic_multiplier_days}).
- **Waterfall Priority**: Incoming payments are auto-allocated in this order: ${(this._getActiveBusinessConfig(this._activeTenantId).finance?.waterfall_priority || []).join(' → ')}.
- **Contracts**: Before generating bills, a tenant must have a negotiated rate card via \`onboard_tenant_contract\`. If not present, ask the CEO to set it up.
- **Ledger**: The ledger is append-only. Use \`get_ledger\` to check a tenant's current balance. Never manually adjust paid amounts.
- **Bills**: Use \`generate_monthly_bills\` with \`payer_id\` and \`month_year\` (e.g., "Mar 2026").`;
    }
}

module.exports = FinanceAI;
