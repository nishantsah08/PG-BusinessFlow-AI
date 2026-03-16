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
                    'record_booking_hold', 'get_booking_holds', 'expire_booking_hold', 'complete_onboarding_from_booking',
                    'offboard_tenant',
                    'record_incoming_txn', 'get_txn_details', 'get_incoming_txns',
                    'record_outgoing_txn', 'get_expenses', 'get_work_orders',
                    'get_ledger', 'add_ledger_entry', 'generate_monthly_bills', 'onboard_tenant_contract', 'get_tenant_statement',
                    'process_salary_payout', 'record_salary_advance',
                    'get_financial_summary', 'get_defaulters_list',
                    'get_unit_collection_status', 'get_assigned_unit_collection_statuses',
                    'add_vendor', 'get_vendors', 'get_vendor_summary',
                    'record_correction_txn'
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
                : {},
            vendors: safe.vendors && typeof safe.vendors === 'object' ? safe.vendors : {},
            bookingHolds: safe.bookingHolds && typeof safe.bookingHolds === 'object' ? safe.bookingHolds : {},
            workOrders: safe.workOrders && typeof safe.workOrders === 'object' ? safe.workOrders : {},
            offboardCases: safe.offboardCases && typeof safe.offboardCases === 'object' ? safe.offboardCases : {},
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
                carryForwardCredits: {},
                vendors: {},
                bookingHolds: {},
                workOrders: {},
                offboardCases: {},
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

    get vendors() {
        return this._getState(this._activeTenantId).vendors;
    }

    set vendors(value) {
        this._getState(this._activeTenantId).vendors = value;
    }

    get bookingHolds() {
        return this._getState(this._activeTenantId).bookingHolds;
    }

    set bookingHolds(value) {
        this._getState(this._activeTenantId).bookingHolds = value;
    }

    get workOrders() {
        return this._getState(this._activeTenantId).workOrders;
    }

    set workOrders(value) {
        this._getState(this._activeTenantId).workOrders = value;
    }

    get offboardCases() {
        return this._getState(this._activeTenantId).offboardCases;
    }

    set offboardCases(value) {
        this._getState(this._activeTenantId).offboardCases = value;
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

    _resolveMonthYearLabel(monthYear) {
        if (typeof monthYear === 'string' && monthYear.trim()) {
            return monthYear.trim();
        }
        return this._toShortMonthYear(new Date());
    }

    _toShortMonthYear(date) {
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[date.getMonth()]} ${date.getFullYear()}`;
    }

    _isSameMonth(dateLike, monthLabel) {
        const safe = this._normalizeBusinessDate(dateLike);
        if (!safe || !monthLabel) return false;
        return this._toShortMonthYear(safe) === monthLabel;
    }

    _nextEntityId(prefix) {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    _normalizeText(value) {
        return String(value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    _formatBusinessDate(date) {
        const safe = this._normalizeBusinessDate(date);
        if (!safe) return null;
        const year = safe.getFullYear();
        const month = String(safe.getMonth() + 1).padStart(2, '0');
        const day = String(safe.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    _addCarryForwardCredit({ payer_id, amount, sourceDate, sourceTxnId, availableFromDate }) {
        if (!(amount > 0)) return null;

        const baseDate = sourceDate instanceof Date && !Number.isNaN(sourceDate.getTime())
            ? sourceDate
            : new Date();
        const effectiveDate = availableFromDate instanceof Date && !Number.isNaN(availableFromDate.getTime())
            ? availableFromDate
            : new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        const credit = {
            id: `CF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount_remaining: amount,
            available_from_key: this._monthKeyFromDate(effectiveDate),
            available_from_month_year: this._toShortMonthYear(effectiveDate),
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

    _buildWorkOrderRecord(args = {}, resolvedPayee, vendorId) {
        const businessDate = this._formatBusinessDate(args.date || new Date()) || this._formatBusinessDate(new Date());
        return {
            work_order_id: this._nextEntityId('WORK'),
            property_id: args.property_id,
            unit_id: args.unit_id || null,
            category: args.category || 'OpEx',
            sub_category: args.sub_category || null,
            work_title: String(args.work_title || args.work_done || args.sub_category || resolvedPayee || 'Business Work').trim(),
            work_summary: String(args.work_done || args.remarks || '').trim() || null,
            status: 'OPEN',
            opened_on: businessDate,
            last_activity_at: businessDate,
            closed_at: null,
            vendor_links: vendorId || resolvedPayee ? [{
                vendor_id: vendorId || null,
                payee: resolvedPayee || null,
                linked_at: businessDate,
                last_linked_at: businessDate
            }] : [],
            expense_entries: [],
            payment_txn_ids: [],
            metadata_audit: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    _normalizeLineItems(lineItems = [], fallbackLabel, fallbackAmount) {
        const rows = Array.isArray(lineItems) ? lineItems : [];
        const normalized = rows
            .map((item, index) => {
                const quantity = Number(item?.quantity || 0);
                const unitPrice = Number(item?.unit_price || 0);
                const explicitLineTotal = Number(item?.line_total || 0);
                const lineTotal = explicitLineTotal > 0
                    ? explicitLineTotal
                    : (quantity > 0 && unitPrice >= 0 ? quantity * unitPrice : 0);
                const itemName = String(item?.item_name || '').trim();
                if (!itemName || !(lineTotal > 0 || (quantity > 0 && unitPrice > 0))) {
                    return null;
                }
                return {
                    line_item_id: item?.line_item_id || `LINE-${Date.now()}-${index}`,
                    item_name: itemName,
                    quantity: quantity > 0 ? quantity : 1,
                    unit_price: unitPrice > 0 ? unitPrice : lineTotal,
                    line_total: lineTotal > 0 ? lineTotal : unitPrice,
                };
            })
            .filter(Boolean);

        if (normalized.length > 0) {
            return normalized;
        }

        if (fallbackLabel && Number(fallbackAmount) > 0) {
            return [{
                line_item_id: `LINE-${Date.now()}-fallback`,
                item_name: String(fallbackLabel).trim(),
                quantity: 1,
                unit_price: Number(fallbackAmount),
                line_total: Number(fallbackAmount),
            }];
        }

        return [];
    }

    _sumLineItems(lineItems = []) {
        return (Array.isArray(lineItems) ? lineItems : []).reduce((sum, item) => sum + Number(item?.line_total || 0), 0);
    }

    _listWorkOrders() {
        return Object.values(this.workOrders || {});
    }

    _getWorkOrder(workOrderId) {
        if (!workOrderId) return null;
        return this.workOrders[workOrderId] || null;
    }

    _findOutgoingWorkCandidates(args = {}, resolvedPayee) {
        const targetTitle = this._normalizeText(args.work_title || args.work_done);
        const targetVendor = args.vendor_id || this._normalizeText(resolvedPayee);
        const targetUnit = args.unit_id || null;
        return this._listWorkOrders().filter((workOrder) => {
            if (workOrder.status === 'CLOSED') return false;
            if (workOrder.property_id !== args.property_id) return false;
            if (targetUnit && workOrder.unit_id && workOrder.unit_id !== targetUnit) return false;
            const sameTitle = targetTitle
                && [workOrder.work_title, workOrder.work_summary]
                    .map((value) => this._normalizeText(value))
                    .includes(targetTitle);
            if (!sameTitle) return false;
            if (!targetVendor) return true;
            return (workOrder.vendor_links || []).some((link) => (
                (args.vendor_id && link.vendor_id === args.vendor_id)
                || (!args.vendor_id && this._normalizeText(link.payee) === targetVendor)
            ));
        });
    }

    _resolveOutgoingWorkOrder(args = {}, resolvedPayee) {
        if (args.work_order_id) {
            const existing = this._getWorkOrder(args.work_order_id);
            if (!existing) {
                return {
                    ok: false,
                    status: 'REQUIRES_FOLLOW_UP',
                    error: `Work context '${args.work_order_id}' was not found. Choose an existing work context or start a new one.`,
                };
            }
            return { ok: true, mode: 'existing', workOrder: existing };
        }

        const workTitle = String(args.work_title || args.work_done || '').trim();
        if (!workTitle) {
            return {
                ok: false,
                status: 'REQUIRES_FOLLOW_UP',
                error: 'Work title or work summary is required so the system can place the outgoing transaction safely.',
            };
        }

        const candidates = this._findOutgoingWorkCandidates(args, resolvedPayee);
        if (candidates.length > 1) {
            return {
                ok: false,
                status: 'REQUIRES_FOLLOW_UP',
                error: 'Multiple open work contexts match this outgoing transaction. Choose the correct work context before recording.',
                follow_up: {
                    question: 'Which existing work context should this outgoing transaction be linked to?',
                    candidate_work_orders: candidates.map((workOrder) => ({
                        work_order_id: workOrder.work_order_id,
                        work_title: workOrder.work_title,
                        property_id: workOrder.property_id,
                        unit_id: workOrder.unit_id || null,
                        status: workOrder.status,
                    })),
                }
            };
        }
        if (candidates.length === 1) {
            return { ok: true, mode: 'existing', workOrder: candidates[0] };
        }

        const created = this._buildWorkOrderRecord(args, resolvedPayee, args.vendor_id || null);
        this.workOrders[created.work_order_id] = created;
        return { ok: true, mode: 'created', workOrder: created };
    }

    _touchWorkOrder(workOrder, dateValue) {
        const businessDate = this._formatBusinessDate(dateValue || new Date()) || this._formatBusinessDate(new Date());
        workOrder.last_activity_at = businessDate;
        workOrder.updated_at = new Date().toISOString();
        return workOrder;
    }

    _appendVendorToWorkOrder(workOrder, vendorId, resolvedPayee, dateValue) {
        if (!vendorId && !resolvedPayee) return;
        const businessDate = this._formatBusinessDate(dateValue || new Date()) || this._formatBusinessDate(new Date());
        const links = Array.isArray(workOrder.vendor_links) ? workOrder.vendor_links : [];
        const existing = links.find((link) => (
            (vendorId && link.vendor_id === vendorId)
            || (!vendorId && this._normalizeText(link.payee) === this._normalizeText(resolvedPayee))
        ));
        if (existing) {
            existing.last_linked_at = businessDate;
            if (resolvedPayee && !existing.payee) existing.payee = resolvedPayee;
            return;
        }
        links.push({
            vendor_id: vendorId || null,
            payee: resolvedPayee || null,
            linked_at: businessDate,
            last_linked_at: businessDate
        });
        workOrder.vendor_links = links;
    }

    _calculateWorkOrderVendorPosition(workOrder, vendorKey) {
        const expenseEntries = Array.isArray(workOrder?.expense_entries) ? workOrder.expense_entries : [];
        const paymentTxnIds = Array.isArray(workOrder?.payment_txn_ids) ? workOrder.payment_txn_ids : [];
        const expenses = expenseEntries.filter((entry) => (
            vendorKey.vendor_id
                ? entry.vendor_id === vendorKey.vendor_id
                : this._normalizeText(entry.payee) === this._normalizeText(vendorKey.payee)
        ));
        const payments = this.transactions.filter((txn) => (
            txn.type === 'OUTGOING'
            && paymentTxnIds.includes(txn.txn_id)
            && (
                vendorKey.vendor_id
                    ? txn.vendor_id === vendorKey.vendor_id
                    : this._normalizeText(txn.payee) === this._normalizeText(vendorKey.payee)
            )
        ));
        const total_incurred = expenses.reduce((sum, entry) => sum + Number(entry.entry_total || 0), 0);
        const total_paid = payments.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
        return {
            total_incurred,
            total_paid,
            balance: total_incurred - total_paid,
        };
    }

    _buildOutgoingDisplayContext(txn = {}) {
        const workOrder = this._getWorkOrder(txn.work_order_id);
        const vendorSummary = txn.vendor_id ? this._getVendorSummary(txn.vendor_id) : null;
        return {
            ...txn,
            work_title: workOrder?.work_title || txn.work_title || txn.work_done || null,
            work_order_status: workOrder?.status || null,
            unit_id: txn.unit_id || workOrder?.unit_id || null,
            vendor_open_balance: vendorSummary?.open_balance ?? null,
            line_items_count: Array.isArray(txn.line_items) ? txn.line_items.length : 0,
        };
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

        const currentTenantId = this._activeTenantId || this.defaultTenantId;
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

    _buildUnitCollectionStatus(unit, options = {}) {
        if (!unit) return null;
        const monthYear = this._resolveMonthYearLabel(options.month_year);
        const payerId = unit.tenant_id || null;
        const monthEntries = payerId
            ? this.ledgerEntries.filter((entry) => entry.payer_id === payerId && entry.month_year === monthYear)
            : [];
        const rentDue = monthEntries
            .filter((entry) => entry.category === 'Rent')
            .reduce((sum, entry) => sum + Number(entry.amount_due || 0), 0);
        const depositDue = monthEntries
            .filter((entry) => String(entry.category || '').toLowerCase().includes('deposit'))
            .reduce((sum, entry) => sum + Number(entry.amount_due || 0), 0);
        const totalDue = monthEntries.reduce((sum, entry) => sum + Number(entry.amount_due || 0), 0);
        const received = monthEntries.reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0);
        const pending = monthEntries.reduce((sum, entry) => sum + Number(entry.balance || 0), 0);

        let status = 'NO_DUES';
        if (payerId && monthEntries.length === 0) {
            status = 'NO_CURRENT_MONTH_LEDGER';
        } else if (pending > 0 && received > 0) {
            status = 'PARTIALLY_PAID';
        } else if (pending > 0) {
            status = 'PENDING';
        } else if (received > 0 || totalDue > 0) {
            status = 'PAID';
        }

        return {
            unit_id: unit.id,
            unit_number: unit.unit_number,
            property_id: unit.property_id,
            tenant_id: payerId,
            staff_assignment: unit.caretaker_staff_id || null,
            month_year: monthYear,
            rent_due: rentDue,
            deposit_due: depositDue,
            total_due: totalDue,
            received,
            pending,
            payment_received: received > 0,
            payment_status: status,
            breakup: monthEntries.map((entry) => ({
                ledger_entry_id: entry.id,
                category: entry.category,
                amount_due: entry.amount_due,
                amount_paid: entry.amount_paid,
                balance: entry.balance,
                status: entry.status,
            })),
        };
    }

    _listUnits(tenantId = this._activeTenantId) {
        const propertyState = this._loadPropertyState(tenantId);
        return Array.isArray(propertyState.units) ? propertyState.units.filter((unit) => unit.status !== 'DELETED') : [];
    }

    _getUnit(unitId, tenantId = this._activeTenantId) {
        return this._listUnits(tenantId).find((unit) => unit.id === unitId) || null;
    }

    _buildContractRecord(args = {}) {
        return {
            contract_id: args.contract_id || `CTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            lead_id: args.lead_id,
            unit_id: args.unit_id || null,
            property_id: args.property_id || null,
            negotiated_rent: Number(args.negotiated_rent || 0),
            security_deposit: Number(args.security_deposit || 0),
            rent_payment_timing: args.rent_payment_timing || 'ADVANCE',
            utility_payment_timing: args.utility_payment_timing || 'ARREARS',
            effective_from: args.effective_from,
            effective_to: args.effective_to || null,
            status: args.status || 'ACTIVE',
            version: args.version || `v${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    _getContractEnvelope(leadId) {
        const existing = this.contracts[leadId];
        if (!existing) {
            return { active_contract_id: null, versions: [] };
        }
        if (Array.isArray(existing.versions)) {
            return existing;
        }
        return {
            active_contract_id: existing.contract_id || null,
            versions: [existing],
        };
    }

    _getContractVersions(leadId) {
        return this._getContractEnvelope(leadId).versions || [];
    }

    _getActiveContract(leadId, targetDate = new Date()) {
        const versions = this._getContractVersions(leadId);
        const targetTs = targetDate instanceof Date ? targetDate.getTime() : new Date(targetDate).getTime();
        const eligible = versions.filter((contract) => {
            const startTs = new Date(contract.effective_from || 0).getTime();
            const endTs = contract.effective_to ? new Date(contract.effective_to).getTime() : Number.POSITIVE_INFINITY;
            return Number.isFinite(startTs) && startTs <= targetTs && targetTs <= endTs && contract.status !== 'CLOSED';
        });
        eligible.sort((a, b) => new Date(b.effective_from || 0).getTime() - new Date(a.effective_from || 0).getTime());
        return eligible[0] || versions.find((contract) => contract.contract_id === this._getContractEnvelope(leadId).active_contract_id) || null;
    }

    _saveContractVersion(args = {}) {
        const leadId = args.lead_id;
        const envelope = this._getContractEnvelope(leadId);
        const newContract = this._buildContractRecord(args);
        const startTs = new Date(newContract.effective_from || 0).getTime();
        const versions = envelope.versions.map((contract) => {
            if (contract.status === 'ACTIVE' && !contract.effective_to && Number.isFinite(startTs)) {
                const priorEnd = new Date(startTs);
                priorEnd.setDate(priorEnd.getDate() - 1);
                return {
                    ...contract,
                    effective_to: this._formatBusinessDate(priorEnd),
                    status: 'CLOSED',
                    updated_at: new Date().toISOString(),
                };
            }
            return contract;
        });
        versions.push(newContract);
        this.contracts[leadId] = {
            active_contract_id: newContract.contract_id,
            versions,
        };
        return newContract;
    }

    _buildVendorRecord(args = {}) {
        return {
            vendor_id: args.vendor_id || `VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            vendor_name: args.vendor_name,
            category: args.category || 'General',
            primary_phone: args.primary_phone || null,
            email: args.email || null,
            upi_id: args.upi_id || null,
            bank_details: args.bank_details || null,
            notes: args.notes || null,
            status: args.status || 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    _getVendorSummary(vendorId) {
        const vendor = this.vendors[vendorId];
        if (!vendor) return null;
        const transactions = this.transactions.filter((txn) => txn.type === 'OUTGOING' && txn.vendor_id === vendorId);
        const currentMonthLabel = this._toShortMonthYear(new Date());
        const current_period_paid = transactions.reduce((sum, txn) => {
            const sourceDate = txn.date ? new Date(txn.date) : new Date(txn.timestamp || Date.now());
            return this._toShortMonthYear(sourceDate) === currentMonthLabel
                ? sum + Number(txn.amount || 0)
                : sum;
        }, 0);
        const vendorWorkPositions = this._listWorkOrders()
            .map((workOrder) => ({
                work_order_id: workOrder.work_order_id,
                work_title: workOrder.work_title,
                ...this._calculateWorkOrderVendorPosition(workOrder, { vendor_id: vendorId, payee: vendor.vendor_name })
            }))
            .filter((row) => row.total_incurred > 0 || row.total_paid > 0);
        return {
            ...vendor,
            total_paid: transactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0),
            current_period_paid,
            transaction_count: transactions.length,
            open_balance: vendorWorkPositions.reduce((sum, row) => sum + Number(row.balance || 0), 0),
            active_work_count: vendorWorkPositions.filter((row) => row.balance !== 0).length,
            recent_transactions: transactions
                .slice()
                .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
                .slice(0, 10),
            work_positions: vendorWorkPositions
        };
    }

    _buildBookingHoldRecord(args = {}) {
        return {
            booking_hold_id: args.booking_hold_id || `BH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            payer_id: args.payer_id,
            amount: Number(args.amount || 0),
            received_at: args.received_at || new Date().toISOString().slice(0, 10),
            valid_until: args.valid_until,
            linked_property_id: args.linked_property_id || null,
            linked_unit_id: args.linked_unit_id || null,
            evidence_link: args.evidence_link || null,
            notes: args.notes || null,
            status: args.status || 'ACTIVE',
            source_txn_id: args.source_txn_id || null,
            applied_on: args.applied_on || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    _calculateBookingHoldExpiry(receivedAt) {
        const base = this._normalizeBusinessDate(receivedAt);
        if (Number.isNaN(base.getTime())) return null;
        base.setDate(base.getDate() + 10);
        return this._formatBusinessDate(base);
    }

    _resolveDaysInMonth(monthYear) {
        const periodDate = this._parseMonthYear(monthYear);
        return new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
    }

    _normalizeBusinessDate(value, fallbackDate = null) {
        if (!value && fallbackDate instanceof Date) {
            return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
            const [year, month, day] = value.trim().split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return fallbackDate instanceof Date
                ? new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate())
                : null;
        }
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    _resolveBillWindowForContract(contract, monthYear) {
        const periodStart = this._parseMonthYear(monthYear);
        const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
        const contractStart = this._normalizeBusinessDate(contract?.effective_from, periodStart) || periodStart;
        const contractEnd = this._normalizeBusinessDate(contract?.effective_to, periodEnd) || periodEnd;
        const start = contractStart > periodStart ? contractStart : periodStart;
        const end = contractEnd < periodEnd ? contractEnd : periodEnd;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return { daysActive: 0, daysInMonth: this._resolveDaysInMonth(monthYear), start: null, end: null };
        }
        const daysActive = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        return {
            daysActive,
            daysInMonth: this._resolveDaysInMonth(monthYear),
            start,
            end,
        };
    }

    _buildIncomingDisplayContext(txn = {}) {
        const unit = txn.linked_unit_id ? this._getUnit(txn.linked_unit_id, this._activeTenantId) : null;
        return {
            ...txn,
            linked_unit_number: unit?.unit_number || null,
            linked_property_id: txn.linked_property_id || unit?.property_id || null,
            context_type: txn.context_type || 'RENT_COLLECTION',
        };
    }

    // --- Tool Implementations ---

    registerTools() {
        // --- 1. Revenue & Collections ---

        this.registerTool('record_booking_hold', 'Record a booking-hold payment before onboarding is completed.', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                amount: { type: 'number' },
                payment_mode: { type: 'string' },
                received_at: { type: 'string' },
                linked_property_id: { type: 'string' },
                linked_unit_id: { type: 'string' },
                evidence_link: { type: 'string' },
                notes: { type: 'string' }
            },
            required: ['payer_id', 'amount']
        }, async (args) => {
            if (!(Number(args.amount) > 0)) {
                return { status: 'REJECTED', reason: 'Booking hold amount must be positive.' };
            }
            const bookingHoldId = `BH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const txnId = `IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const hold = this._buildBookingHoldRecord({
                booking_hold_id: bookingHoldId,
                payer_id: args.payer_id,
                amount: Number(args.amount),
                received_at: args.received_at || new Date().toISOString().slice(0, 10),
                valid_until: this._calculateBookingHoldExpiry(args.received_at || new Date().toISOString().slice(0, 10)),
                linked_property_id: args.linked_property_id,
                linked_unit_id: args.linked_unit_id,
                evidence_link: args.evidence_link,
                notes: args.notes,
                source_txn_id: txnId,
            });
            this.bookingHolds[hold.booking_hold_id] = hold;
            this.transactions.push({
                txn_id: txnId,
                type: 'INCOMING',
                payer_id: args.payer_id,
                amount: Number(args.amount),
                payment_mode: args.payment_mode || 'UPI',
                date: hold.received_at,
                attachment_url: args.evidence_link || undefined,
                linked_unit_id: args.linked_unit_id || null,
                linked_property_id: args.linked_property_id || null,
                context_type: 'BOOKING_HOLD',
                booking_hold_id: hold.booking_hold_id,
                allocations: [],
                unallocated_surplus: Number(args.amount),
                timestamp: new Date().toISOString(),
                note: args.notes || undefined,
            });
            return {
                status: 'SUCCESS',
                booking_hold_id: hold.booking_hold_id,
                txn_id: txnId,
                valid_until: hold.valid_until,
            };
        });

        this.registerTool('get_booking_holds', 'List booking holds for the tenant.', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                status: { type: 'string' },
                limit: { type: 'number' }
            }
        }, async ({ payer_id, status, limit } = {}) => {
            let rows = Object.values(this.bookingHolds);
            if (payer_id) rows = rows.filter((hold) => hold.payer_id === payer_id);
            if (status) rows = rows.filter((hold) => hold.status === status);
            rows.sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')));
            return { booking_holds: rows.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
        });

        this.registerTool('expire_booking_hold', 'Expire a booking hold and mark it forfeited when onboarding does not complete in time.', {
            type: 'object',
            properties: {
                booking_hold_id: { type: 'string' }
            },
            required: ['booking_hold_id']
        }, async ({ booking_hold_id }) => {
            const hold = this.bookingHolds[booking_hold_id];
            if (!hold) return { status: 'REJECTED', reason: 'Booking hold not found.' };
            if (hold.status !== 'ACTIVE') {
                return { status: 'REJECTED', reason: `Booking hold is already ${hold.status}.` };
            }
            hold.status = 'EXPIRED_FORFEITED';
            hold.updated_at = new Date().toISOString();
            this.bookingHolds[booking_hold_id] = hold;
            return { status: 'SUCCESS', booking_hold_id, updated_status: hold.status };
        });

        this.registerTool('complete_onboarding_from_booking', 'Create contract from booking hold and apply it commercially from onboarding date.', {
            type: 'object',
            properties: {
                booking_hold_id: { type: 'string' },
                lead_id: { type: 'string' },
                unit_id: { type: 'string' },
                property_id: { type: 'string' },
                onboarding_date: { type: 'string' },
                negotiated_rent: { type: 'number' },
                security_deposit: { type: 'number' },
                rent_payment_timing: { type: 'string' },
                utility_payment_timing: { type: 'string' },
            },
            required: ['booking_hold_id', 'lead_id', 'onboarding_date', 'negotiated_rent']
        }, async (args) => {
            const hold = this.bookingHolds[args.booking_hold_id];
            if (!hold) return { status: 'REJECTED', reason: 'Booking hold not found.' };
            if (hold.status !== 'ACTIVE') {
                return { status: 'REJECTED', reason: `Booking hold is ${hold.status}.` };
            }

            const contract = this._saveContractVersion({
                lead_id: args.lead_id,
                unit_id: args.unit_id || hold.linked_unit_id || null,
                property_id: args.property_id || hold.linked_property_id || null,
                negotiated_rent: args.negotiated_rent,
                security_deposit: args.security_deposit,
                rent_payment_timing: args.rent_payment_timing,
                utility_payment_timing: args.utility_payment_timing,
                effective_from: args.onboarding_date,
            });

            const onboardingDate = this._normalizeBusinessDate(args.onboarding_date, new Date());
            const credit = this._addCarryForwardCredit({
                payer_id: args.lead_id,
                amount: hold.amount,
                sourceDate: new Date(hold.received_at),
                sourceTxnId: hold.source_txn_id,
                availableFromDate: onboardingDate,
            });

            hold.status = 'APPLIED_ON_ONBOARDING';
            hold.applied_on = args.onboarding_date;
            hold.linked_unit_id = args.unit_id || hold.linked_unit_id || null;
            hold.linked_property_id = args.property_id || hold.linked_property_id || null;
            hold.updated_at = new Date().toISOString();
            this.bookingHolds[args.booking_hold_id] = hold;

            return {
                status: 'SUCCESS',
                booking_hold_id: args.booking_hold_id,
                contract_id: contract.contract_id,
                carry_forward_credit_id: credit?.id || null,
            };
        });

        this.registerTool('offboard_tenant', 'Calculate and close tenant offboarding after settlement movement is completed.', {
            type: 'object',
            properties: {
                payer_id: { type: 'string' },
                move_out_date: { type: 'string' },
                settlement_direction: { type: 'string', enum: ['RECEIVE', 'SEND', 'NONE'] },
                settlement_amount: { type: 'number' },
                settlement_payment_mode: { type: 'string' },
                ceo_comment: { type: 'string' },
                customer_message: { type: 'string' },
                notice_days_given: { type: 'number' },
                min_stay_status: { type: 'string' }
            },
            required: ['payer_id', 'move_out_date', 'settlement_direction', 'settlement_amount', 'ceo_comment', 'customer_message']
        }, async (args) => {
            const settlementDirection = String(args.settlement_direction || 'NONE').toUpperCase();
            const settlementAmount = Number(args.settlement_amount || 0);
            if (!(settlementAmount >= 0)) {
                return { status: 'REJECTED', reason: 'Settlement amount must be zero or positive.' };
            }
            if (!['RECEIVE', 'SEND', 'NONE'].includes(settlementDirection)) {
                return { status: 'REJECTED', reason: 'Invalid settlement direction.' };
            }
            if (settlementDirection === 'NONE' && settlementAmount !== 0) {
                return { status: 'REJECTED', reason: 'Settlement amount must be zero when direction is NONE.' };
            }
            if ((settlementDirection === 'RECEIVE' || settlementDirection === 'SEND') && settlementAmount <= 0) {
                return { status: 'REJECTED', reason: 'Settlement amount must be positive for RECEIVE or SEND.' };
            }
            if (!String(args.customer_message || '').trim()) {
                return { status: 'REJECTED', reason: 'Final customer settlement message is mandatory.' };
            }
            if (!String(args.ceo_comment || '').trim()) {
                return { status: 'REJECTED', reason: 'CEO closure comment is mandatory.' };
            }

            let settlementTxnId = null;
            const businessDate = args.move_out_date || new Date().toISOString().slice(0, 10);
            if (settlementDirection === 'RECEIVE') {
                const incomingTxn = {
                    txn_id: this._nextEntityId('IN'),
                    type: 'INCOMING',
                    payer_id: args.payer_id,
                    amount: settlementAmount,
                    payment_mode: args.settlement_payment_mode || 'UPI',
                    date: businessDate,
                    context_type: 'OFFBOARD_SETTLEMENT_RECEIVE',
                    allocations: [],
                    unallocated_surplus: settlementAmount,
                    timestamp: new Date().toISOString(),
                    note: 'Final offboarding settlement received.'
                };
                this.transactions.push(incomingTxn);
                settlementTxnId = incomingTxn.txn_id;
            }

            if (settlementDirection === 'SEND') {
                const outgoingTxn = {
                    txn_id: this._nextEntityId('OUT'),
                    type: 'OUTGOING',
                    category: 'OpEx',
                    sub_category: 'Tenant Settlement Refund',
                    work_title: 'Tenant Offboarding Settlement',
                    work_done: 'Final settlement payout during offboarding closure.',
                    property_id: null,
                    unit_id: null,
                    work_order_id: null,
                    amount: settlementAmount,
                    expense_total_delta: settlementAmount,
                    line_items: [{
                        item_name: 'Offboarding settlement payout',
                        quantity: 1,
                        unit_price: settlementAmount,
                        line_total: settlementAmount
                    }],
                    date: businessDate,
                    vendor_id: null,
                    payee: args.payer_id,
                    payment_mode: args.settlement_payment_mode || 'UPI',
                    approved_by: args.approved_by || null,
                    remarks: 'Final offboarding settlement payout.',
                    attachment_urls: [],
                    timestamp: new Date().toISOString(),
                    metadata_editable_fields: ['remarks']
                };
                this.transactions.push(outgoingTxn);
                settlementTxnId = outgoingTxn.txn_id;
            }

            const offboardId = this._nextEntityId('OFFB');
            const record = {
                offboarding_id: offboardId,
                payer_id: args.payer_id,
                move_out_date: businessDate,
                settlement_direction: settlementDirection,
                settlement_amount: settlementAmount,
                settlement_payment_mode: args.settlement_payment_mode || 'UPI',
                settlement_txn_id: settlementTxnId,
                notice_days_given: Number(args.notice_days_given || 0),
                min_stay_status: args.min_stay_status || 'UNKNOWN',
                ceo_comment: String(args.ceo_comment || '').trim(),
                customer_message: String(args.customer_message || '').trim(),
                closed_at: new Date().toISOString(),
                status: 'CLOSED',
            };
            this.offboardCases[offboardId] = record;

            return {
                status: 'SUCCESS',
                offboarding_id: offboardId,
                settlement_txn_id: settlementTxnId,
                settlement_direction: settlementDirection,
                settlement_amount: settlementAmount,
                customer_message_sent: true,
            };
        });

        this.registerTool('record_incoming_txn', 'Allocate and record an incoming payment', {
            type: 'object',
            properties: {
                amount: { type: 'number' },
                payer_id: { type: 'string' },
                payment_mode: { type: 'string' },
                date: { type: 'string' },
                attachment_url: { type: 'string' },
                txn_id: { type: 'string' },
                linked_unit_id: { type: 'string' },
                linked_property_id: { type: 'string' },
                context_type: { type: 'string' },
                note: { type: 'string' },
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
            list = list.map((txn) => this._buildIncomingDisplayContext(txn));
            list.sort((a, b) => {
                const aUnit = String(a.linked_unit_number || 'ZZZ');
                const bUnit = String(b.linked_unit_number || 'ZZZ');
                if (aUnit !== bUnit) return aUnit.localeCompare(bUnit, 'en', { numeric: true });
                return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
            });
            return { transactions: list.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
        });

        // --- 2. Expenses ---

        this.registerTool('record_outgoing_txn', 'Record an office or property expense', {
            type: 'object',
            properties: {
                category: { type: 'string', enum: ['OpEx', 'CapEx'] },
                sub_category: { type: 'string' },
                work_done: { type: 'string' },
                work_title: { type: 'string' },
                work_order_id: { type: 'string' },
                property_id: { type: 'string' },
                unit_id: { type: 'string' },
                amount: { type: 'number' },
                expense_total: { type: 'number' },
                line_items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            item_name: { type: 'string' },
                            quantity: { type: 'number' },
                            unit_price: { type: 'number' },
                            line_total: { type: 'number' }
                        }
                    }
                },
                date: { type: 'string' },
                vendor_id: { type: 'string' },
                payee: { type: 'string' },
                payment_mode: { type: 'string' },
                approved_by: { type: 'string' },
                remarks: { type: 'string' },
                attachment_urls: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['category', 'amount', 'property_id', 'payment_mode']
        }, async (args) => {
            if (!args.property_id) {
                return { status: 'REQUIRES_FOLLOW_UP', error: 'Property is required for outgoing transaction recording.' };
            }
            if (!args.vendor_id && !String(args.payee || '').trim()) {
                return { status: 'REQUIRES_FOLLOW_UP', error: 'Vendor or payee is required for outgoing expense posting.' };
            }
            const resolvedPayee = args.vendor_id && this.vendors[args.vendor_id]
                ? this.vendors[args.vendor_id].vendor_name
                : String(args.payee || '').trim();
            const workContext = this._resolveOutgoingWorkOrder(args, resolvedPayee);
            if (!workContext.ok) {
                return {
                    status: workContext.status || 'REQUIRES_FOLLOW_UP',
                    error: workContext.error,
                    follow_up: workContext.follow_up || null,
                };
            }

            const workOrder = workContext.workOrder;
            const businessDate = args.date || new Date().toISOString().slice(0, 10);
            const fallbackLabel = args.work_done || args.work_title || args.sub_category || resolvedPayee || 'Expense item';
            const normalizedLineItems = this._normalizeLineItems(args.line_items, fallbackLabel, args.expense_total || args.amount);
            const explicitExpenseTotal = Number(args.expense_total || 0);
            const derivedExpenseTotal = this._sumLineItems(normalizedLineItems);
            const paymentOnly = Boolean(args.work_order_id)
                && !String(args.work_title || '').trim()
                && !String(args.work_done || '').trim()
                && !(explicitExpenseTotal > 0)
                && (!Array.isArray(args.line_items) || args.line_items.length === 0);
            const expenseEntryTotal = explicitExpenseTotal > 0
                ? explicitExpenseTotal
                : (derivedExpenseTotal > 0 ? derivedExpenseTotal : 0);

            if (!paymentOnly && !(expenseEntryTotal > 0)) {
                return {
                    status: 'REQUIRES_FOLLOW_UP',
                    error: 'Add line items or an expense total so the system can understand what was incurred under this work.',
                };
            }

            this._appendVendorToWorkOrder(workOrder, args.vendor_id || null, resolvedPayee, businessDate);
            this._touchWorkOrder(workOrder, businessDate);

            if (!paymentOnly) {
                workOrder.expense_entries = Array.isArray(workOrder.expense_entries) ? workOrder.expense_entries : [];
                workOrder.expense_entries.push({
                    expense_entry_id: this._nextEntityId('EXP'),
                    vendor_id: args.vendor_id || null,
                    payee: resolvedPayee || null,
                    line_items: normalizedLineItems,
                    entry_total: expenseEntryTotal,
                    date: businessDate,
                    remarks: args.remarks || null,
                    recorded_at: new Date().toISOString()
                });
            }

            const txn = {
                txn_id: this._nextEntityId('OUT'),
                type: 'OUTGOING',
                category: args.category,
                sub_category: args.sub_category || null,
                work_title: workOrder.work_title,
                work_done: args.work_done || workOrder.work_summary || null,
                property_id: args.property_id,
                unit_id: args.unit_id || workOrder.unit_id || null,
                work_order_id: workOrder.work_order_id,
                amount: Number(args.amount),
                expense_total_delta: paymentOnly ? 0 : expenseEntryTotal,
                line_items: paymentOnly ? [] : normalizedLineItems,
                date: businessDate,
                vendor_id: args.vendor_id || null,
                payee: resolvedPayee,
                payment_mode: args.payment_mode,
                approved_by: args.approved_by || null,
                remarks: args.remarks || null,
                attachment_urls: Array.isArray(args.attachment_urls) ? args.attachment_urls : [],
                timestamp: new Date().toISOString(),
                metadata_editable_fields: ['work_title', 'work_done', 'remarks']
            };
            this.transactions.push(txn);
            workOrder.payment_txn_ids = Array.isArray(workOrder.payment_txn_ids) ? workOrder.payment_txn_ids : [];
            workOrder.payment_txn_ids.push(txn.txn_id);

            const vendorPosition = args.vendor_id
                ? this._calculateWorkOrderVendorPosition(workOrder, { vendor_id: args.vendor_id, payee: resolvedPayee })
                : null;
            const vendorRecord = args.vendor_id ? this.vendors[args.vendor_id] : null;
            const vendorConfirmation = vendorRecord?.primary_phone
                ? {
                    recipient_phone: vendorRecord.primary_phone,
                    message: [
                        `Payment confirmation from ${args.approved_by || 'PG-BusinessFlow.ai'}.`,
                        `Thank you. INR ${Number(args.amount || 0).toLocaleString('en-IN')} was recorded on ${businessDate}.`,
                        `Work: ${workOrder.work_title}`,
                        `Property: ${args.property_id}`,
                    ].join(' ')
                }
                : null;

            return {
                status: 'SUCCESS',
                txn_id: txn.txn_id,
                work_order_id: workOrder.work_order_id,
                work_order_mode: workContext.mode,
                payment_only: paymentOnly,
                vendor_confirmation: vendorConfirmation,
                vendor_balance_after_payment: vendorPosition?.balance ?? null
            };
        });

        this.registerTool('record_correction_txn', 'Create a compensating correction transaction without editing the original record', {
            type: 'object',
            properties: {
                original_txn_id: { type: 'string' },
                correction_type: { type: 'string', enum: ['REVERSAL', 'ADJUSTMENT'] },
                payer_id: { type: 'string' },
                amount: { type: 'number' },
                reason: { type: 'string' },
                category: { type: 'string' },
                month_year: { type: 'string' }
            },
            required: ['original_txn_id', 'correction_type', 'amount', 'reason']
        }, async (args) => {
            const original = this.transactions.find((transaction) => transaction.txn_id === args.original_txn_id)
                || this.ledgerEntries.find((entry) => entry.id === args.original_txn_id);
            if (!original) {
                return { status: 'REJECTED', reason: 'Original finance record not found.' };
            }

            const correctionTxn = {
                txn_id: `CORR-${Date.now()}`,
                type: 'CORRECTION',
                original_txn_id: args.original_txn_id,
                correction_type: args.correction_type,
                payer_id: args.payer_id || original.payer_id || null,
                amount: Number(args.amount),
                reason: args.reason,
                category: args.category || original.category || null,
                month_year: args.month_year || original.month_year || null,
                timestamp: new Date().toISOString()
            };
            this.transactions.push(correctionTxn);

            return {
                status: 'SUCCESS',
                txn_id: correctionTxn.txn_id,
                original_txn_id: args.original_txn_id,
                correction_type: args.correction_type,
            };
        });

        this.registerTool('get_expenses', 'List outgoing expense transactions', {
            type: 'object',
            properties: {
                category: { type: 'string' },
                payee: { type: 'string' },
                vendor_id: { type: 'string' },
                work_order_id: { type: 'string' },
                limit: { type: 'number' }
            }
        }, async ({ category, payee, vendor_id, work_order_id, limit } = {}) => {
            let list = this.transactions.filter(t => t.type === 'OUTGOING');
            if (category) list = list.filter(t => t.category === category);
            if (payee) list = list.filter(t => String(t.payee || '').toLowerCase().includes(String(payee).toLowerCase()));
            if (vendor_id) list = list.filter((t) => t.vendor_id === vendor_id);
            if (work_order_id) list = list.filter((t) => t.work_order_id === work_order_id);
            list = list.map((txn) => this._buildOutgoingDisplayContext(txn));
            list.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
            return { transactions: list.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
        });

        this.registerTool('get_work_orders', 'List finance work contexts used by outgoing transactions.', {
            type: 'object',
            properties: {
                property_id: { type: 'string' },
                status: { type: 'string' },
                search: { type: 'string' },
                limit: { type: 'number' }
            }
        }, async ({ property_id, status, search, limit } = {}) => {
            let rows = this._listWorkOrders();
            if (property_id) rows = rows.filter((workOrder) => workOrder.property_id === property_id);
            if (status) rows = rows.filter((workOrder) => workOrder.status === status);
            if (search) {
                const needle = this._normalizeText(search);
                rows = rows.filter((workOrder) => (
                    this._normalizeText(workOrder.work_title).includes(needle)
                    || this._normalizeText(workOrder.work_summary).includes(needle)
                    || this._normalizeText(workOrder.work_order_id).includes(needle)
                ));
            }
            rows = rows
                .slice()
                .sort((a, b) => String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || '')))
                .map((workOrder) => ({
                    work_order_id: workOrder.work_order_id,
                    property_id: workOrder.property_id,
                    unit_id: workOrder.unit_id || null,
                    category: workOrder.category,
                    work_title: workOrder.work_title,
                    work_summary: workOrder.work_summary,
                    status: workOrder.status,
                    opened_on: workOrder.opened_on,
                    last_activity_at: workOrder.last_activity_at,
                    vendor_count: Array.isArray(workOrder.vendor_links) ? workOrder.vendor_links.length : 0,
                    payment_count: Array.isArray(workOrder.payment_txn_ids) ? workOrder.payment_txn_ids.length : 0,
                }));
            return { work_orders: rows.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
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
                effective_from: { type: 'string' },
                effective_to: { type: 'string' },
                unit_id: { type: 'string' },
                property_id: { type: 'string' }
            },
            required: ['lead_id', 'negotiated_rent']
        }, async (args) => {
            const contract = this._saveContractVersion(args);
            return { status: 'SUCCESS', message: 'Contract negotiated and stored', contract_id: contract.contract_id, contract };
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
            const contractVersions = this._getContractVersions(args.payer_id);
            if (contractVersions.length === 0) return { status: 'ERROR', message: 'No negotiated contract found for this tenant' };

            const items = [];
            contractVersions.forEach((contract) => {
                const window = this._resolveBillWindowForContract(contract, args.month_year);
                if (!(window.daysActive > 0)) return;
                const proratedRent = Math.round((Number(contract.negotiated_rent || 0) * window.daysActive) / Math.max(window.daysInMonth, 1));
                if (proratedRent > 0) {
                    items.push({
                        category: 'Rent',
                        amount: proratedRent,
                        source_contract_id: contract.contract_id,
                        charge_window: {
                            from: this._formatBusinessDate(window.start),
                            to: this._formatBusinessDate(window.end),
                            days_active: window.daysActive,
                            days_in_month: window.daysInMonth,
                        }
                    });
                }
            });
            if (items.length === 0) return { status: 'ERROR', message: 'No billable contract window found for this tenant and month.' };

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
                    created_at: new Date().toISOString(),
                    source_contract_id: item.source_contract_id || null,
                    charge_window: item.charge_window || null,
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
        }, async ({ date_range }) => {
            const range = String(date_range || 'CURRENT_MONTH').trim().toUpperCase();
            const currentMonthLabel = this._toShortMonthYear(new Date());
            const inScopeByMonth = (dateLike) => range === 'ALL_TIME' || this._isSameMonth(dateLike, currentMonthLabel);

            const scopedTransactions = this.transactions.filter((transaction) => {
                const businessDate = transaction.date || transaction.timestamp || transaction.received_at || transaction.created_at;
                return inScopeByMonth(businessDate);
            });
            const inflow = scopedTransactions
                .filter(t => t.type === 'INCOMING')
                .reduce((a, b) => a + Number(b.amount || 0), 0);
            const outflow = scopedTransactions
                .filter(t => t.type === 'OUTGOING' || t.type === 'SALARY_PAYOUT')
                .reduce((a, b) => a + Number(b.amount || 0), 0);
            const outstanding = this.ledgerEntries
                .filter((entry) => range === 'ALL_TIME' || entry.month_year === currentMonthLabel)
                .reduce((a, b) => a + Number(b.balance || 0), 0);
            const cashInHand = inflow - outflow;
            const activeBookingHolds = Object.values(this.bookingHolds).filter((hold) => (
                hold.status === 'ACTIVE' && inScopeByMonth(hold.received_at || hold.created_at || hold.updated_at)
            )).length;

            return {
                total_inflow: inflow,
                total_outflow: outflow,
                total_cash_in_hand: cashInHand,
                total_outstanding: outstanding,
                booking_holds_active: activeBookingHolds,
                date_range_applied: range,
            };
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

        this.registerTool('add_vendor', 'Create a vendor in the finance vendor register.', {
            type: 'object',
            properties: {
                vendor_name: { type: 'string' },
                category: { type: 'string' },
                primary_phone: { type: 'string' },
                email: { type: 'string' },
                upi_id: { type: 'string' },
                bank_details: { type: 'object' },
                notes: { type: 'string' },
            },
            required: ['vendor_name']
        }, async (args) => {
            const existing = Object.values(this.vendors).find((vendor) => String(vendor.vendor_name || '').trim().toLowerCase() === String(args.vendor_name || '').trim().toLowerCase());
            if (existing) {
                return { status: 'SUCCESS', vendor_id: existing.vendor_id, vendor: existing, mode: 'existing' };
            }
            const vendor = this._buildVendorRecord(args);
            this.vendors[vendor.vendor_id] = vendor;
            return { status: 'SUCCESS', vendor_id: vendor.vendor_id, vendor, mode: 'created' };
        });

        this.registerTool('get_vendors', 'List vendors in the finance register.', {
            type: 'object',
            properties: {
                search: { type: 'string' },
                category: { type: 'string' },
                limit: { type: 'number' },
            }
        }, async ({ search, category, limit } = {}) => {
            let rows = Object.values(this.vendors);
            if (category) rows = rows.filter((vendor) => vendor.category === category);
            if (search) {
                const needle = String(search).trim().toLowerCase();
                rows = rows.filter((vendor) => (
                    String(vendor.vendor_name || '').toLowerCase().includes(needle)
                    || String(vendor.primary_phone || '').toLowerCase().includes(needle)
                    || String(vendor.email || '').toLowerCase().includes(needle)
                ));
            }
            rows = rows
                .map((vendor) => this._getVendorSummary(vendor.vendor_id))
                .sort((a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')));
            return { vendors: rows.slice(0, Number(limit) > 0 ? Number(limit) : 100) };
        });

        this.registerTool('get_vendor_summary', 'Get vendor accounting summary.', {
            type: 'object',
            properties: {
                vendor_id: { type: 'string' }
            },
            required: ['vendor_id']
        }, async ({ vendor_id }) => {
            const summary = this._getVendorSummary(vendor_id);
            if (!summary) return { status: 'ERROR', message: 'Vendor not found' };
            return { status: 'SUCCESS', vendor: summary };
        });

        this.registerTool('get_unit_collection_status', 'Get current-month finance status for a specific unit', {
            type: 'object',
            properties: {
                unit_id: { type: 'string' },
                month_year: { type: 'string' },
                staff_id: { type: 'string' }
            },
            required: ['unit_id']
        }, async (args) => {
            const propertyState = this._loadPropertyState(this._activeTenantId);
            const unit = (Array.isArray(propertyState.units) ? propertyState.units : [])
                .find((candidate) => candidate.id === args.unit_id && candidate.status !== 'DELETED');
            if (!unit) return { status: 'ERROR', message: 'Unit not found' };
            if (args.staff_id && unit.caretaker_staff_id && unit.caretaker_staff_id !== args.staff_id) {
                return { status: 'REJECTED', reason: 'Staff can only view current-month finance for assigned units.' };
            }
            return {
                status: 'SUCCESS',
                data: this._buildUnitCollectionStatus(unit, args),
            };
        });

        this.registerTool('get_assigned_unit_collection_statuses', 'List current-month finance status for units assigned to a staff member', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                month_year: { type: 'string' },
                property_id: { type: 'string' }
            },
            required: ['staff_id']
        }, async (args) => {
            const propertyState = this._loadPropertyState(this._activeTenantId);
            let units = (Array.isArray(propertyState.units) ? propertyState.units : [])
                .filter((unit) => unit.status !== 'DELETED' && unit.caretaker_staff_id === args.staff_id);
            if (args.property_id) {
                units = units.filter((unit) => unit.property_id === args.property_id);
            }
            return {
                status: 'SUCCESS',
                month_year: this._resolveMonthYearLabel(args.month_year),
                units: units.map((unit) => this._buildUnitCollectionStatus(unit, args)),
            };
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
