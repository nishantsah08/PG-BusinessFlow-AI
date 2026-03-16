import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Bot, CheckCircle2, Clock3, Landmark, Loader2, Paperclip, Plus, Workflow, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import DateInputField from '../components/common/DateInputField';
import { useTimeDisplay } from '../hooks/useTimeDisplay';

const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;
const todayInputValue = () => new Date().toISOString().slice(0, 10);
const artifactNameFromUrl = (url) => {
    const source = String(url || '').trim();
    if (!source) return 'Uploaded artifact';
    const tail = source.split('/').pop() || source;
    return decodeURIComponent(tail);
};

const blankIncomingForm = {
    payer_input: '',
    linked_property_id: '',
    linked_unit_id: '',
    amount: '',
    payment_mode: 'UPI',
    date: todayInputValue(),
    attachment_urls: [],
    txn_id: '',
    note: '',
};

const blankBookingHoldForm = {
    payer_input: '',
    linked_property_id: '',
    linked_unit_id: '',
    amount: '',
    payment_mode: 'UPI',
    received_at: todayInputValue(),
    evidence_links: [],
    notes: '',
};

const blankOnboardingForm = {
    booking_hold_id: '',
    lead_input: '',
    property_id: '',
    unit_id: '',
    onboarding_date: todayInputValue(),
    negotiated_rent: '',
    security_deposit: '',
    rent_payment_timing: 'ADVANCE',
    utility_payment_timing: 'ARREARS',
};

const blankOutgoingForm = {
    property_id: '',
    unit_id: '',
    category: 'OpEx',
    sub_category: '',
    work_order_input: '',
    work_title: '',
    work_done: '',
    vendor_mode: 'registered',
    vendor_input: '',
    payee: '',
    amount: '',
    payment_mode: 'UPI',
    date: todayInputValue(),
    line_items: [{ item_name: '', quantity: '1', unit_price: '', line_total: '' }],
    attachment_urls: [],
    remarks: '',
};

const blankVendorForm = {
    vendor_name: '',
    category: 'Maintenance',
    primary_phone: '',
    email: '',
    upi_id: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    ifsc: '',
    notes: '',
};

const ModalShell = ({ title, subtitle, onClose, children }) => (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 pb-6 pt-24">
        <div className="flex min-h-full items-start justify-center">
            <div className="max-h-[calc(100dvh-6.5rem)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                    {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
                </div>
                <button type="button" aria-label="Close Finance Modal" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <X className="h-5 w-5" />
                </button>
            </div>
                <div className="max-h-[calc(100dvh-12.5rem)] overflow-y-auto px-6 py-5">{children}</div>
            </div>
        </div>
    </div>
);

const FormRow = ({ label, hint, children }) => (
    <div className="grid gap-3 border-b border-slate-100 py-4 md:grid-cols-[220px_1fr] md:items-start">
        <div>
            <div className="text-sm font-semibold text-slate-900">{label}</div>
            {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
        <div className="min-w-0">{children}</div>
    </div>
);

const inputClasses = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400';
const textareaClasses = 'min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400';
const previewClasses = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700';
const uploadButtonClasses = 'inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50';
const summaryDateFilters = [
    { value: 'CURRENT_MONTH', label: 'Current Month' },
    { value: 'ALL_TIME', label: 'All Time' },
];

const FINANCE_TOOL_DEFAULT_CONTEXT_KEYS = {
    record_incoming_txn: ['payer_id', 'amount', 'payment_mode', 'date', 'attachment_url', 'txn_id', 'linked_unit_id', 'linked_property_id', 'note'],
    record_booking_hold: ['payer_id', 'amount', 'payment_mode', 'received_at', 'linked_property_id', 'linked_unit_id', 'evidence_link', 'notes'],
    complete_onboarding_from_booking: ['booking_hold_id', 'lead_id', 'unit_id', 'property_id', 'onboarding_date', 'negotiated_rent', 'security_deposit', 'rent_payment_timing', 'utility_payment_timing'],
    record_outgoing_txn: ['category', 'sub_category', 'work_done', 'work_title', 'work_order_id', 'property_id', 'unit_id', 'amount', 'line_items', 'date', 'vendor_id', 'payee', 'payment_mode', 'remarks', 'attachment_urls'],
    add_vendor: ['vendor_name', 'category', 'primary_phone', 'email', 'upi_id', 'bank_details', 'notes'],
};

const FINANCE_TOOL_KNOWN_CONTEXT_KEYS = {
    record_incoming_txn: ['payer_id', 'linked_property_id', 'linked_unit_id', 'amount', 'payment_mode', 'date', 'attachment_url', 'txn_id', 'note'],
    record_booking_hold: ['payer_id', 'linked_property_id', 'linked_unit_id', 'amount', 'payment_mode', 'received_at', 'evidence_link', 'notes'],
    complete_onboarding_from_booking: ['booking_hold_id', 'lead_id', 'property_id', 'unit_id', 'onboarding_date', 'negotiated_rent', 'security_deposit', 'rent_payment_timing', 'utility_payment_timing'],
    record_outgoing_txn: ['property_id', 'unit_id', 'category', 'sub_category', 'work_order_id', 'work_title', 'work_done', 'line_items', 'amount', 'payment_mode', 'date', 'attachment_urls', 'remarks', 'vendor_id', 'payee'],
    add_vendor: ['vendor_name', 'category', 'primary_phone', 'email', 'upi_id', 'bank_details', 'notes'],
};

const FINANCE_BUTTON_CONTRACT_FALLBACK = {
    record_incoming_txn: {
        workflow_id: 'finance_record_incoming_txn_v1',
        context_keys: FINANCE_TOOL_DEFAULT_CONTEXT_KEYS.record_incoming_txn,
        required_context_keys: ['payer_id', 'amount'],
        any_of_context_keys: [],
        field_schema: [],
        smart_behavior: [],
    },
    record_booking_hold: {
        workflow_id: 'finance_record_booking_hold_v1',
        context_keys: FINANCE_TOOL_DEFAULT_CONTEXT_KEYS.record_booking_hold,
        required_context_keys: ['payer_id', 'amount'],
        any_of_context_keys: [],
        field_schema: [],
        smart_behavior: [],
    },
    complete_onboarding_from_booking: {
        workflow_id: 'finance_complete_onboarding_from_booking_v1',
        context_keys: FINANCE_TOOL_DEFAULT_CONTEXT_KEYS.complete_onboarding_from_booking,
        required_context_keys: ['booking_hold_id', 'lead_id', 'onboarding_date', 'negotiated_rent'],
        any_of_context_keys: [],
        field_schema: [],
        smart_behavior: [],
    },
    record_outgoing_txn: {
        workflow_id: 'finance_record_outgoing_txn_v1',
        context_keys: FINANCE_TOOL_DEFAULT_CONTEXT_KEYS.record_outgoing_txn,
        required_context_keys: ['property_id', 'amount'],
        any_of_context_keys: [['vendor_id', 'payee']],
        field_schema: [],
        smart_behavior: [],
    },
    add_vendor: {
        workflow_id: 'finance_add_vendor_v1',
        context_keys: FINANCE_TOOL_DEFAULT_CONTEXT_KEYS.add_vendor,
        required_context_keys: ['vendor_name'],
        any_of_context_keys: [],
        field_schema: [],
        smart_behavior: [],
    },
};

const valuePresent = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== '';
};

const payloadValuePresent = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
};

const humanizeContextKey = (key) => (
    String(key || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
);

const parseDynamicValueByType = (field = {}, rawValue = '') => {
    const type = String(field?.type || 'string').toLowerCase();
    if (type === 'number') {
        const numeric = Number(rawValue);
        return Number.isFinite(numeric) ? numeric : undefined;
    }
    if (type === 'boolean') {
        if (rawValue === true || rawValue === false) return rawValue;
        if (String(rawValue).toLowerCase() === 'true') return true;
        if (String(rawValue).toLowerCase() === 'false') return false;
        return undefined;
    }
    if (type === 'array' || type === 'object') {
        if (!String(rawValue || '').trim()) return undefined;
        try {
            return JSON.parse(String(rawValue));
        } catch {
            return undefined;
        }
    }
    return String(rawValue || '').trim();
};

const toButtonContractMap = (buttons = []) => {
    const byTool = { ...FINANCE_BUTTON_CONTRACT_FALLBACK };
    (Array.isArray(buttons) ? buttons : []).forEach((button) => {
        const toolName = String(button?.tool_name || '').trim();
        if (!toolName) return;
        byTool[toolName] = {
            ...(byTool[toolName] || {}),
            ...button,
            context_keys: Array.isArray(button?.context_keys) && button.context_keys.length > 0
                ? button.context_keys
                : (byTool[toolName]?.context_keys || FINANCE_TOOL_DEFAULT_CONTEXT_KEYS[toolName] || []),
            required_context_keys: Array.isArray(button?.required_context_keys)
                ? button.required_context_keys
                : (byTool[toolName]?.required_context_keys || []),
            any_of_context_keys: Array.isArray(button?.any_of_context_keys)
                ? button.any_of_context_keys
                : (byTool[toolName]?.any_of_context_keys || []),
            field_schema: Array.isArray(button?.field_schema)
                ? button.field_schema
                : (byTool[toolName]?.field_schema || []),
            smart_behavior: Array.isArray(button?.smart_behavior)
                ? button.smart_behavior
                : (byTool[toolName]?.smart_behavior || []),
        };
    });
    return byTool;
};

const WorkflowPreview = ({ title, rows }) => (
    <div className={previewClasses}>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
            {rows.filter((row) => row && row.value !== undefined && row.value !== null && String(row.value).trim() !== '').map((row) => (
                <div key={row.label}>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{row.label}</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{row.value}</div>
                </div>
            ))}
        </div>
    </div>
);

const FinancePage = () => {
    const navigate = useNavigate();
    const { authContext, authContextLoading } = useAuth();
    const { formatTime } = useTimeDisplay();
    const profileType = authContextLoading ? '' : (authContext?.profile_type || 'Customer');

    const [summary, setSummary] = useState(null);
    const [incomingRows, setIncomingRows] = useState([]);
    const [outgoingRows, setOutgoingRows] = useState([]);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [activity, setActivity] = useState([]);
    const [assignedUnits, setAssignedUnits] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [workOrders, setWorkOrders] = useState([]);
    const [bookingHolds, setBookingHolds] = useState([]);
    const [referenceLeads, setReferenceLeads] = useState([]);
    const [referenceProperties, setReferenceProperties] = useState([]);
    const [referenceUnits, setReferenceUnits] = useState([]);
    const [financeDataLoading, setFinanceDataLoading] = useState(false);
    const [notice, setNotice] = useState('Loading Finance...');
    const [activeTab, setActiveTab] = useState('overview');
    const [requestState, setRequestState] = useState('');
    const [showIncomingModal, setShowIncomingModal] = useState(false);
    const [showBookingHoldModal, setShowBookingHoldModal] = useState(false);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [showOutgoingModal, setShowOutgoingModal] = useState(false);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [artifactUploads, setArtifactUploads] = useState({ incoming: false, bookingHold: false, outgoing: false });
    const [incomingForm, setIncomingForm] = useState(blankIncomingForm);
    const [bookingHoldForm, setBookingHoldForm] = useState(blankBookingHoldForm);
    const [onboardingForm, setOnboardingForm] = useState(blankOnboardingForm);
    const [outgoingForm, setOutgoingForm] = useState(blankOutgoingForm);
    const [vendorForm, setVendorForm] = useState(blankVendorForm);
    const [approvalNotes, setApprovalNotes] = useState({});
    const [activeApprovalId, setActiveApprovalId] = useState('');
    const [summaryDateRange, setSummaryDateRange] = useState('CURRENT_MONTH');
    const [buttonContracts, setButtonContracts] = useState(() => ({ ...FINANCE_BUTTON_CONTRACT_FALLBACK }));
    const [dynamicContextValuesByTool, setDynamicContextValuesByTool] = useState({});

    const financeTabs = useMemo(() => (
        profileType === 'CEO'
            ? [
                { key: 'overview', label: 'Overview' },
                { key: 'incoming', label: 'Incoming' },
                { key: 'outgoing', label: 'Outgoing' },
                { key: 'vendors', label: 'Vendors' },
                { key: 'activity', label: 'Activity' },
            ]
            : profileType === 'Staff'
                ? [
                    { key: 'overview', label: 'Overview' },
                    { key: 'activity', label: 'Activity' },
                ]
                : [{ key: 'overview', label: 'Overview' }]
    ), [profileType]);

    useEffect(() => {
        if (!financeTabs.find((tab) => tab.key === activeTab)) {
            setActiveTab(financeTabs[0]?.key || 'overview');
        }
    }, [activeTab, financeTabs]);

    const executeAgentTool = useCallback(async (agentName, toolName, parameters = {}) => {
        setRequestState(toolName);
        try {
            return await apiClient.post('/api/master_ai/tools/execute', {
                agent_name: agentName,
                tool_name: toolName,
                parameters,
            });
        } finally {
            setRequestState('');
        }
    }, []);

    const propertyMap = useMemo(() => new Map(referenceProperties.map((property) => [property.id, property])), [referenceProperties]);
    const unitMap = useMemo(() => new Map(referenceUnits.map((unit) => [unit.id, unit])), [referenceUnits]);
    const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.vendor_id, vendor])), [vendors]);
    const bookingHoldMap = useMemo(() => new Map(bookingHolds.map((hold) => [hold.booking_hold_id, hold])), [bookingHolds]);
    const workOrderMap = useMemo(() => new Map(workOrders.map((workOrder) => [workOrder.work_order_id, workOrder])), [workOrders]);

    const leadOptions = useMemo(() => referenceLeads.map((lead) => ({
        label: `${lead.name || lead.lead_id} (${lead.lead_id})`,
        lead_id: lead.lead_id,
    })), [referenceLeads]);
    const leadLabelToId = useMemo(() => new Map(leadOptions.map((option) => [option.label, option.lead_id])), [leadOptions]);

    const vendorOptions = useMemo(() => vendors.map((vendor) => ({
        label: `${vendor.vendor_name} (${vendor.vendor_id})`,
        vendor_id: vendor.vendor_id,
    })), [vendors]);
    const vendorLabelToId = useMemo(() => new Map(vendorOptions.map((option) => [option.label, option.vendor_id])), [vendorOptions]);
    const workOrderOptions = useMemo(() => workOrders.map((workOrder) => ({
        label: `${workOrder.work_title} (${workOrder.work_order_id})`,
        work_order_id: workOrder.work_order_id,
    })), [workOrders]);
    const workOrderLabelToId = useMemo(() => new Map(workOrderOptions.map((option) => [option.label, option.work_order_id])), [workOrderOptions]);

    const resolveLeadId = useCallback((value) => {
        const needle = String(value || '').trim();
        return leadLabelToId.get(needle) || needle;
    }, [leadLabelToId]);

    const resolveLeadPreview = useCallback((value) => {
        const needle = String(value || '').trim();
        if (!needle) return '';
        const matchedOption = leadOptions.find((option) => option.label === needle);
        if (matchedOption) return matchedOption.label;
        const matchedLead = referenceLeads.find((lead) => lead.lead_id === needle);
        if (matchedLead) {
            return `${matchedLead.name || matchedLead.lead_id} (${matchedLead.lead_id})`;
        }
        return needle;
    }, [leadOptions, referenceLeads]);

    const resolveVendorId = useCallback((value) => {
        const needle = String(value || '').trim();
        if (vendorLabelToId.has(needle)) return vendorLabelToId.get(needle);
        const direct = vendors.find((vendor) => vendor.vendor_id === needle || vendor.vendor_name === needle);
        if (direct) return direct.vendor_id;
        const prefixMatches = vendors.filter((vendor) => String(vendor.vendor_name || '').toLowerCase().startsWith(needle.toLowerCase()));
        if (prefixMatches.length === 1) return prefixMatches[0].vendor_id;
        return '';
    }, [vendorLabelToId, vendors]);

    const resolveWorkOrderId = useCallback((value) => {
        const needle = String(value || '').trim();
        if (!needle) return '';
        if (workOrderLabelToId.has(needle)) return workOrderLabelToId.get(needle);
        const direct = workOrders.find((workOrder) => workOrder.work_order_id === needle || workOrder.work_title === needle);
        if (direct) return direct.work_order_id;
        const prefixMatches = workOrders.filter((workOrder) => String(workOrder.work_title || '').toLowerCase().startsWith(needle.toLowerCase()));
        if (prefixMatches.length === 1) return prefixMatches[0].work_order_id;
        return '';
    }, [workOrderLabelToId, workOrders]);

    const getButtonContract = useCallback((toolName) => (
        buttonContracts[toolName] || FINANCE_BUTTON_CONTRACT_FALLBACK[toolName] || null
    ), [buttonContracts]);

    const getButtonWorkflowId = useCallback((toolName) => (
        getButtonContract(toolName)?.workflow_id
        || FINANCE_BUTTON_CONTRACT_FALLBACK[toolName]?.workflow_id
        || 'Not configured'
    ), [getButtonContract]);

    const getButtonFieldSchema = useCallback((toolName) => {
        const contract = getButtonContract(toolName);
        const provided = Array.isArray(contract?.field_schema) ? contract.field_schema : [];
        if (provided.length > 0) return provided;
        const contextKeys = Array.isArray(contract?.context_keys) && contract.context_keys.length > 0
            ? contract.context_keys
            : (FINANCE_TOOL_DEFAULT_CONTEXT_KEYS[toolName] || []);
        const required = new Set(Array.isArray(contract?.required_context_keys) ? contract.required_context_keys : []);
        return contextKeys.map((key) => ({
            key,
            label: humanizeContextKey(key),
            hint: null,
            type: 'string',
            source: 'text_input',
            required: required.has(key),
            enum: [],
            depends_on: null,
            any_of_group_indexes: [],
        }));
    }, [getButtonContract]);

    const getButtonContextKeys = useCallback((toolName) => (
        getButtonFieldSchema(toolName).map((field) => field.key)
    ), [getButtonFieldSchema]);

    const shouldShowContractField = useCallback((toolName, fieldKey) => {
        const keys = getButtonContextKeys(toolName);
        if (keys.length === 0) return true;
        return keys.includes(fieldKey);
    }, [getButtonContextKeys]);

    const getUnknownContractFields = useCallback((toolName) => {
        const known = new Set(FINANCE_TOOL_KNOWN_CONTEXT_KEYS[toolName] || []);
        return getButtonFieldSchema(toolName).filter((field) => !known.has(field.key));
    }, [getButtonFieldSchema]);

    const setDynamicContextValue = useCallback((toolName, fieldKey, nextValue) => {
        setDynamicContextValuesByTool((current) => ({
            ...current,
            [toolName]: {
                ...(current[toolName] || {}),
                [fieldKey]: nextValue,
            },
        }));
    }, []);

    const clearDynamicContextValues = useCallback((toolName) => {
        setDynamicContextValuesByTool((current) => {
            if (!current[toolName]) return current;
            const next = { ...current };
            delete next[toolName];
            return next;
        });
    }, []);

    const buildPayloadForContract = useCallback((toolName, rawPayload = {}) => {
        const contextKeys = getButtonContextKeys(toolName);
        if (contextKeys.length === 0) return rawPayload;

        const fieldByKey = new Map(getButtonFieldSchema(toolName).map((field) => [field.key, field]));
        const dynamicValues = dynamicContextValuesByTool[toolName] || {};
        const merged = { ...rawPayload };
        Object.entries(dynamicValues).forEach(([key, rawValue]) => {
            if (Object.prototype.hasOwnProperty.call(merged, key)) return;
            const parsed = parseDynamicValueByType(fieldByKey.get(key), rawValue);
            if (payloadValuePresent(parsed)) {
                merged[key] = parsed;
            }
        });

        const filtered = {};
        contextKeys.forEach((key) => {
            if (payloadValuePresent(merged[key])) {
                filtered[key] = merged[key];
            }
        });
        return filtered;
    }, [dynamicContextValuesByTool, getButtonContextKeys, getButtonFieldSchema]);

    const renderDynamicFieldInput = useCallback((toolName, field) => {
        const fieldKey = String(field?.key || '').trim();
        const source = String(field?.source || '').trim();
        const fieldType = String(field?.type || 'string').trim();
        const enumValues = Array.isArray(field?.enum) ? field.enum : [];
        const currentValue = dynamicContextValuesByTool[toolName]?.[fieldKey] ?? '';

        if (source === 'lead_lookup') {
            const listId = `finance-leads-${toolName}-${fieldKey}`;
            return (
                <>
                    <input
                        aria-label={field.label || fieldKey}
                        list={listId}
                        value={currentValue}
                        onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                        placeholder="Search by name or phone"
                        className={inputClasses}
                    />
                    <datalist id={listId}>
                        {leadOptions.map((option) => <option key={option.lead_id} value={option.label} />)}
                    </datalist>
                </>
            );
        }

        if (source === 'property_select') {
            return (
                <select
                    aria-label={field.label || fieldKey}
                    value={currentValue}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    className={inputClasses}
                >
                    <option value="">Select property</option>
                    {referenceProperties.map((property) => (
                        <option key={property.id} value={property.id}>{property.name}</option>
                    ))}
                </select>
            );
        }

        if (source === 'unit_select') {
            return (
                <select
                    aria-label={field.label || fieldKey}
                    value={currentValue}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    className={inputClasses}
                >
                    <option value="">Select unit</option>
                    {referenceUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>
                    ))}
                </select>
            );
        }

        if (source === 'booking_hold_select') {
            const selectableBookingHolds = bookingHolds.filter((hold) => hold.status === 'ACTIVE');
            return (
                <select
                    aria-label={field.label || fieldKey}
                    value={currentValue}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    className={inputClasses}
                >
                    <option value="">Select booking hold</option>
                    {selectableBookingHolds.map((hold) => (
                        <option key={hold.booking_hold_id} value={hold.booking_hold_id}>
                            {hold.booking_hold_id} · {hold.payer_id}
                        </option>
                    ))}
                </select>
            );
        }

        if (source === 'vendor_select') {
            const listId = `finance-vendors-${toolName}-${fieldKey}`;
            return (
                <>
                    <input
                        aria-label={field.label || fieldKey}
                        list={listId}
                        value={currentValue}
                        onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                        placeholder="Search vendor"
                        className={inputClasses}
                    />
                    <datalist id={listId}>
                        {vendorOptions.map((option) => <option key={option.vendor_id} value={option.label} />)}
                    </datalist>
                </>
            );
        }

        if (source === 'work_order_select') {
            const listId = `finance-work-orders-${toolName}-${fieldKey}`;
            return (
                <>
                    <input
                        aria-label={field.label || fieldKey}
                        list={listId}
                        value={currentValue}
                        onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                        placeholder="Search work title or ID"
                        className={inputClasses}
                    />
                    <datalist id={listId}>
                        {workOrderOptions.map((option) => <option key={option.work_order_id} value={option.label} />)}
                    </datalist>
                </>
            );
        }

        if (source === 'date_input' || fieldKey === 'date' || fieldKey.endsWith('_date')) {
            return (
                <DateInputField
                    ariaLabel={field.label || fieldKey}
                    value={currentValue}
                    onValueChange={(nextValue) => setDynamicContextValue(toolName, fieldKey, nextValue)}
                    className={inputClasses}
                />
            );
        }

        if (enumValues.length > 0 || source === 'enum_select') {
            return (
                <select
                    aria-label={field.label || fieldKey}
                    value={currentValue}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    className={inputClasses}
                >
                    <option value="">Select</option>
                    {enumValues.map((optionValue) => (
                        <option key={String(optionValue)} value={String(optionValue)}>{String(optionValue)}</option>
                    ))}
                </select>
            );
        }

        if (source === 'boolean_toggle' || fieldType === 'boolean') {
            return (
                <select
                    aria-label={field.label || fieldKey}
                    value={String(currentValue || '')}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    className={inputClasses}
                >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            );
        }

        if (source === 'json_editor' || fieldType === 'array' || fieldType === 'object') {
            return (
                <textarea
                    aria-label={field.label || fieldKey}
                    value={currentValue}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    placeholder='Provide JSON value'
                    className={textareaClasses}
                />
            );
        }

        if (source === 'textarea' || fieldKey.includes('note') || fieldKey.includes('remark') || fieldKey.includes('comment')) {
            return (
                <textarea
                    aria-label={field.label || fieldKey}
                    value={currentValue}
                    onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                    placeholder={field.hint || `Enter ${field.label || humanizeContextKey(fieldKey)}`}
                    className={textareaClasses}
                />
            );
        }

        return (
            <input
                aria-label={field.label || fieldKey}
                value={currentValue}
                onChange={(event) => setDynamicContextValue(toolName, fieldKey, event.target.value)}
                type={fieldType === 'number' ? 'number' : 'text'}
                step={fieldType === 'number' ? '0.01' : undefined}
                placeholder={field.hint || `Enter ${field.label || humanizeContextKey(fieldKey)}`}
                className={inputClasses}
            />
        );
    }, [
        bookingHolds,
        dynamicContextValuesByTool,
        leadOptions,
        referenceProperties,
        referenceUnits,
        setDynamicContextValue,
        vendorOptions,
        workOrderOptions,
    ]);

    const validatePayloadAgainstContract = useCallback((toolName, payload = {}) => {
        const contract = getButtonContract(toolName);
        if (!contract) return true;
        const requiredKeys = Array.isArray(contract.required_context_keys) ? contract.required_context_keys : [];
        const missing = requiredKeys.filter((key) => !valuePresent(payload[key]));
        if (missing.length > 0) {
            setNotice(`Missing required field(s): ${missing.join(', ')}.`);
            return false;
        }

        const anyOfGroups = Array.isArray(contract.any_of_context_keys) ? contract.any_of_context_keys : [];
        for (const group of anyOfGroups) {
            const keys = Array.isArray(group) ? group : [];
            if (keys.length > 0 && !keys.some((key) => valuePresent(payload[key]))) {
                setNotice(`Provide at least one of: ${keys.join(' or ')}.`);
                return false;
            }
        }
        return true;
    }, [getButtonContract]);

    const uploadArtifacts = useCallback(async (files, target) => {
        const selectedFiles = Array.from(files || []);
        if (selectedFiles.length === 0) return;
        setArtifactUploads((current) => ({ ...current, [target]: true }));
        try {
            const formData = new FormData();
            selectedFiles.forEach((file) => formData.append('artifacts', file));
            const response = await apiClient.post('/api/upload/artifacts', formData);
            if (!response?.success) {
                setNotice(response?.error || 'Artifact upload failed.');
                return;
            }
            const urls = Array.isArray(response.data?.urls) ? response.data.urls : [];
            const extractedReference = String(response.data?.extracted_reference || '').trim();
            if (target === 'incoming') {
                setIncomingForm((current) => ({
                    ...current,
                    attachment_urls: [...current.attachment_urls, ...urls],
                    txn_id: current.txn_id || extractedReference || current.txn_id,
                }));
            } else if (target === 'bookingHold') {
                setBookingHoldForm((current) => ({
                    ...current,
                    evidence_links: [...current.evidence_links, ...urls],
                }));
            } else if (target === 'outgoing') {
                setOutgoingForm((current) => ({
                    ...current,
                    attachment_urls: [...current.attachment_urls, ...urls],
                }));
            }
            if (extractedReference && target === 'incoming') {
                setNotice(`Reference auto-filled from uploaded proof: ${extractedReference}`);
            }
        } finally {
            setArtifactUploads((current) => ({ ...current, [target]: false }));
        }
    }, []);

    const ceoFinanceDataReady = useMemo(() => (
        profileType !== 'CEO'
            || (summary !== null
                && referenceLeads.length > 0
                && referenceProperties.length > 0
                && referenceUnits.length > 0)
    ), [profileType, summary, referenceLeads.length, referenceProperties.length, referenceUnits.length]);

    const loadFinance = useCallback(async ({ preserveNotice = false } = {}) => {
        if (authContextLoading || !profileType) {
            return false;
        }
        setFinanceDataLoading(true);
        try {
            const requests = [
                apiClient.get('/api/finance/approvals'),
                apiClient.get('/api/master_ai/events?limit=50'),
                apiClient.get('/api/finance/button-contracts'),
            ];

            if (profileType === 'CEO') {
                requests.push(
                    executeAgentTool('FinanceAI', 'get_financial_summary', { date_range: summaryDateRange }),
                    executeAgentTool('FinanceAI', 'get_incoming_txns', { limit: 200 }),
                    executeAgentTool('FinanceAI', 'get_expenses', { limit: 200 }),
                    executeAgentTool('FinanceAI', 'get_work_orders', { limit: 200 }),
                    executeAgentTool('FinanceAI', 'get_vendors', { limit: 200 }),
                    executeAgentTool('FinanceAI', 'get_booking_holds', { limit: 200 }),
                    executeAgentTool('CRMAgent', 'get_recent_leads', { limit: 200 }),
                    executeAgentTool('PropertyAI', 'get_properties', {}),
                    executeAgentTool('PropertyAI', 'get_units', {}),
                );
            } else if (profileType === 'Staff') {
                requests.push(
                    executeAgentTool('FinanceAI', 'get_assigned_unit_collection_statuses', {}),
                );
            }

            const responses = await Promise.all(requests);
            const [approvalResponse, eventResponse, buttonContractsResponse, extraA, extraB, extraC, extraWorkOrders, extraD, extraE, extraF, extraG, extraH] = responses;
            const contractButtons = Array.isArray(buttonContractsResponse?.data?.buttons) ? buttonContractsResponse.data.buttons : [];
            setButtonContracts(toButtonContractMap(contractButtons));

            setPendingApprovals(Array.isArray(approvalResponse?.data?.pending) ? approvalResponse.data.pending : []);
            setActivity(Array.isArray(eventResponse?.data) ? eventResponse.data : []);

            if (profileType === 'CEO') {
                setSummary(extraA?.data || null);
                setIncomingRows(Array.isArray(extraB?.data?.transactions) ? extraB.data.transactions : []);
                setOutgoingRows(Array.isArray(extraC?.data?.transactions) ? extraC.data.transactions : []);
                setWorkOrders(Array.isArray(extraWorkOrders?.data?.work_orders) ? extraWorkOrders.data.work_orders : []);
                setVendors(Array.isArray(extraD?.data?.vendors) ? extraD.data.vendors : []);
                setBookingHolds(Array.isArray(extraE?.data?.booking_holds) ? extraE.data.booking_holds : []);
                setReferenceLeads(Array.isArray(extraF?.data?.leads) ? extraF.data.leads : []);
                setReferenceProperties(Array.isArray(extraG?.data) ? extraG.data : []);
                setReferenceUnits(Array.isArray(extraH?.data) ? extraH.data : []);
                if (!preserveNotice) {
                    setNotice('Finance mutations submit through business forms here, then execute under protected workflows in MasterAI.');
                }
            } else if (profileType === 'Staff') {
                setAssignedUnits(Array.isArray(extraA?.data?.units) ? extraA.data.units : []);
                if (!preserveNotice) {
                    setNotice('You are seeing only current-month finance for units assigned to you. Any mutation still requires CEO approval.');
                }
            } else {
                if (!preserveNotice) {
                    setNotice('Finance GUI is limited here. Use CRM, Property booking context, or WhatsApp for your own dues and payment updates.');
                }
            }
            return true;
        } catch (error) {
            setNotice(error?.message || 'Failed to load Finance.');
            return false;
        } finally {
            setFinanceDataLoading(false);
        }
    }, [authContextLoading, executeAgentTool, profileType, summaryDateRange]);

    useEffect(() => {
        loadFinance();
    }, [loadFinance]);

    const workflowActivity = useMemo(() => (
        activity.filter((event) => {
            const eventType = String(event?.event_type || '');
            const payloadWorkflow = String(event?.payload?.workflow_id || '');
            const payloadAgent = String(event?.payload?.agent || '');
            return eventType.startsWith('workflow.')
                || payloadWorkflow.startsWith('finance_')
                || payloadAgent === 'FinanceAI';
        }).slice(0, 25)
    ), [activity]);

    const activeBookingHolds = useMemo(() => bookingHolds.filter((hold) => hold.status === 'ACTIVE'), [bookingHolds]);
    const sortedIncomingRows = useMemo(() => (
        [...incomingRows].sort((left, right) => {
            const leftUnit = String(left.linked_unit_number || 'ZZZ');
            const rightUnit = String(right.linked_unit_number || 'ZZZ');
            const unitCompare = leftUnit.localeCompare(rightUnit, undefined, { numeric: true, sensitivity: 'base' });
            if (unitCompare !== 0) return unitCompare;
            const leftDate = String(left.date || left.timestamp || '');
            const rightDate = String(right.date || right.timestamp || '');
            return rightDate.localeCompare(leftDate);
        })
    ), [incomingRows]);

    const resolveLeadName = useCallback((leadId) => {
        const needle = String(leadId || '').trim();
        if (!needle) return '';
        const matchedLead = referenceLeads.find((lead) => lead.lead_id === needle);
        return matchedLead?.name || '';
    }, [referenceLeads]);

    const incomingUnits = useMemo(() => {
        if (!incomingForm.linked_property_id) return referenceUnits;
        return referenceUnits.filter((unit) => unit.property_id === incomingForm.linked_property_id);
    }, [incomingForm.linked_property_id, referenceUnits]);

    const bookingHoldUnits = useMemo(() => {
        if (!bookingHoldForm.linked_property_id) return referenceUnits;
        return referenceUnits.filter((unit) => unit.property_id === bookingHoldForm.linked_property_id);
    }, [bookingHoldForm.linked_property_id, referenceUnits]);

    const onboardingUnits = useMemo(() => {
        if (!onboardingForm.property_id) return referenceUnits;
        return referenceUnits.filter((unit) => unit.property_id === onboardingForm.property_id);
    }, [onboardingForm.property_id, referenceUnits]);

    const handleWorkflowOutcome = useCallback(async (response, successNotice, pendingNotice, reset) => {
        if (response?.success) {
            const data = response.data || {};
            if (data.status === 'REQUIRES_FOLLOW_UP' || data.status === 'REJECTED' || data.status === 'ERROR') {
                setNotice(data.error || data.reason || 'Workflow needs more detail before execution.');
                return;
            }
            reset();
            const refreshed = await loadFinance({ preserveNotice: true });
            if (refreshed) {
                setNotice(data.status === 'PENDING_CEO_AUTHORIZATION' ? pendingNotice : successNotice);
            }
            return;
        }
        setNotice(response?.error || 'Workflow failed.');
    }, [loadFinance]);

    const updateOutgoingLineItem = useCallback((index, field, value) => {
        setOutgoingForm((current) => ({
            ...current,
            line_items: current.line_items.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [field]: value } : item
            ))
        }));
    }, []);

    const addOutgoingLineItem = useCallback(() => {
        setOutgoingForm((current) => ({
            ...current,
            line_items: [...current.line_items, { item_name: '', quantity: '1', unit_price: '', line_total: '' }]
        }));
    }, []);

    const removeOutgoingLineItem = useCallback((index) => {
        setOutgoingForm((current) => ({
            ...current,
            line_items: current.line_items.length <= 1
                ? [{ item_name: '', quantity: '1', unit_price: '', line_total: '' }]
                : current.line_items.filter((_, itemIndex) => itemIndex !== index)
        }));
    }, []);

    const handleSubmitIncoming = async (event) => {
        event.preventDefault();
        if (!ceoFinanceDataReady) {
            setNotice('Finance reference data is still loading. Please wait a moment and try again.');
            return;
        }
        const payerId = resolveLeadId(incomingForm.payer_input);
        if (!payerId || !(Number(incomingForm.amount) > 0)) {
            setNotice('Incoming payment needs a payer and a positive amount.');
            return;
        }

        const basePayload = {
            payer_id: payerId,
            linked_property_id: incomingForm.linked_property_id || undefined,
            linked_unit_id: incomingForm.linked_unit_id || undefined,
            amount: Number(incomingForm.amount),
            payment_mode: incomingForm.payment_mode,
            date: incomingForm.date || undefined,
            attachment_url: incomingForm.attachment_urls[0] || undefined,
            txn_id: incomingForm.txn_id || undefined,
            note: incomingForm.note || undefined,
        };
        const payload = buildPayloadForContract('record_incoming_txn', basePayload);
        if (!validatePayloadAgainstContract('record_incoming_txn', payload)) return;
        const response = await executeAgentTool('FinanceAI', 'record_incoming_txn', payload);

        await handleWorkflowOutcome(
            response,
            'Incoming payment workflow executed successfully.',
            'Incoming payment request is waiting for CEO authorization.',
            () => {
                setShowIncomingModal(false);
                setIncomingForm(blankIncomingForm);
                clearDynamicContextValues('record_incoming_txn');
            }
        );
    };

    const handleSubmitBookingHold = async (event) => {
        event.preventDefault();
        if (!ceoFinanceDataReady) {
            setNotice('Finance reference data is still loading. Please wait a moment and try again.');
            return;
        }
        const payerId = resolveLeadId(bookingHoldForm.payer_input);
        if (!payerId || !(Number(bookingHoldForm.amount) > 0)) {
            setNotice('Booking hold needs a payer and a positive amount.');
            return;
        }

        const basePayload = {
            payer_id: payerId,
            linked_property_id: bookingHoldForm.linked_property_id || undefined,
            linked_unit_id: bookingHoldForm.linked_unit_id || undefined,
            amount: Number(bookingHoldForm.amount),
            payment_mode: bookingHoldForm.payment_mode,
            received_at: bookingHoldForm.received_at || undefined,
            evidence_link: bookingHoldForm.evidence_links[0] || undefined,
            notes: bookingHoldForm.notes || undefined,
        };
        const payload = buildPayloadForContract('record_booking_hold', basePayload);
        if (!validatePayloadAgainstContract('record_booking_hold', payload)) return;
        const response = await executeAgentTool('FinanceAI', 'record_booking_hold', payload);

        await handleWorkflowOutcome(
            response,
            'Booking hold workflow executed successfully.',
            'Booking hold request is waiting for CEO authorization.',
            () => {
                setShowBookingHoldModal(false);
                setBookingHoldForm(blankBookingHoldForm);
                clearDynamicContextValues('record_booking_hold');
            }
        );
    };

    const handleSubmitOnboarding = async (event) => {
        event.preventDefault();
        if (!ceoFinanceDataReady) {
            setNotice('Finance reference data is still loading. Please wait a moment and try again.');
            return;
        }
        const leadId = resolveLeadId(onboardingForm.lead_input);
        if (!onboardingForm.booking_hold_id || !leadId || !onboardingForm.unit_id || !onboardingForm.onboarding_date || !(Number(onboardingForm.negotiated_rent) > 0)) {
            setNotice('Onboarding from booking needs booking hold, payer, unit, onboarding date, and negotiated rent.');
            return;
        }

        const basePayload = {
            booking_hold_id: onboardingForm.booking_hold_id,
            lead_id: leadId,
            unit_id: onboardingForm.unit_id,
            property_id: onboardingForm.property_id || unitMap.get(onboardingForm.unit_id)?.property_id || undefined,
            onboarding_date: onboardingForm.onboarding_date,
            negotiated_rent: Number(onboardingForm.negotiated_rent),
            security_deposit: Number(onboardingForm.security_deposit || 0),
            rent_payment_timing: onboardingForm.rent_payment_timing,
            utility_payment_timing: onboardingForm.utility_payment_timing,
        };
        const payload = buildPayloadForContract('complete_onboarding_from_booking', basePayload);
        if (!validatePayloadAgainstContract('complete_onboarding_from_booking', payload)) return;
        const response = await executeAgentTool('FinanceAI', 'complete_onboarding_from_booking', payload);

        await handleWorkflowOutcome(
            response,
            'Onboarding-from-booking workflow executed successfully.',
            'Onboarding-from-booking request is waiting for CEO authorization.',
            () => {
                setShowOnboardingModal(false);
                setOnboardingForm(blankOnboardingForm);
                clearDynamicContextValues('complete_onboarding_from_booking');
            }
        );
    };

    const handleSubmitOutgoing = async (event) => {
        event.preventDefault();
        if (!ceoFinanceDataReady) {
            setNotice('Finance reference data is still loading. Please wait a moment and try again.');
            return;
        }
        const workOrderId = resolveWorkOrderId(outgoingForm.work_order_input);
        const vendorId = outgoingForm.vendor_mode === 'registered' ? resolveVendorId(outgoingForm.vendor_input) : '';
        const payee = outgoingForm.vendor_mode === 'registered'
            ? ''
            : String(outgoingForm.payee || '').trim();
        const normalizedLineItems = (Array.isArray(outgoingForm.line_items) ? outgoingForm.line_items : [])
            .map((item) => ({
                item_name: String(item.item_name || '').trim(),
                quantity: Number(item.quantity || 0),
                unit_price: Number(item.unit_price || 0),
                line_total: Number(item.line_total || 0),
            }))
            .filter((item) => item.item_name && ((item.quantity > 0 && item.unit_price > 0) || item.line_total > 0));

        if (!(Number(outgoingForm.amount) > 0) || !outgoingForm.property_id || (!vendorId && !payee)) {
            setNotice('Outgoing transaction needs a property, a payee or vendor, and a positive paid amount.');
            return;
        }
        if (!workOrderId && !String(outgoingForm.work_title || '').trim() && !String(outgoingForm.work_done || '').trim()) {
            setNotice('Add a work title or select an existing work context so the outgoing transaction can be placed safely.');
            return;
        }

        const basePayload = {
            property_id: outgoingForm.property_id,
            unit_id: outgoingForm.unit_id || undefined,
            category: outgoingForm.category,
            sub_category: outgoingForm.sub_category || undefined,
            work_order_id: workOrderId || undefined,
            work_title: outgoingForm.work_title || undefined,
            work_done: outgoingForm.work_done || undefined,
            amount: Number(outgoingForm.amount),
            line_items: normalizedLineItems,
            vendor_id: vendorId || undefined,
            payee: payee || undefined,
            payment_mode: outgoingForm.payment_mode,
            date: outgoingForm.date || undefined,
            attachment_urls: outgoingForm.attachment_urls,
            remarks: outgoingForm.remarks || undefined,
        };
        const payload = buildPayloadForContract('record_outgoing_txn', basePayload);
        if (!validatePayloadAgainstContract('record_outgoing_txn', payload)) return;
        const response = await executeAgentTool('FinanceAI', 'record_outgoing_txn', payload);

        await handleWorkflowOutcome(
            response,
            'Outgoing expense workflow executed successfully.',
            'Outgoing expense request is waiting for CEO authorization.',
            () => {
                setShowOutgoingModal(false);
                setOutgoingForm(blankOutgoingForm);
                clearDynamicContextValues('record_outgoing_txn');
            }
        );
    };

    const handleSubmitVendor = async (event) => {
        event.preventDefault();
        if (!ceoFinanceDataReady) {
            setNotice('Finance reference data is still loading. Please wait a moment and try again.');
            return;
        }
        if (!String(vendorForm.vendor_name || '').trim()) {
            setNotice('Vendor name is required.');
            return;
        }

        const basePayload = {
            vendor_name: vendorForm.vendor_name.trim(),
            category: vendorForm.category,
            primary_phone: vendorForm.primary_phone || undefined,
            email: vendorForm.email || undefined,
            upi_id: vendorForm.upi_id || undefined,
            bank_details: vendorForm.bank_name || vendorForm.account_holder || vendorForm.account_number || vendorForm.ifsc
                ? {
                    bank_name: vendorForm.bank_name || undefined,
                    account_holder: vendorForm.account_holder || undefined,
                    account_number: vendorForm.account_number || undefined,
                    ifsc: vendorForm.ifsc || undefined,
                }
                : undefined,
            notes: vendorForm.notes || undefined,
        };
        const payload = buildPayloadForContract('add_vendor', basePayload);
        if (!validatePayloadAgainstContract('add_vendor', payload)) return;
        const response = await executeAgentTool('FinanceAI', 'add_vendor', payload);

        await handleWorkflowOutcome(
            response,
            'Vendor registration workflow executed successfully.',
            'Vendor registration request is waiting for CEO authorization.',
            () => {
                setShowVendorModal(false);
                setVendorForm(blankVendorForm);
                clearDynamicContextValues('add_vendor');
            }
        );
    };

    const handleApproval = async (authorizationId, action) => {
        setActiveApprovalId(authorizationId);
        const endpoint = action === 'approve'
            ? `/api/finance/approvals/${authorizationId}/approve`
            : `/api/finance/approvals/${authorizationId}/reject`;
        const response = await apiClient.post(
            endpoint,
            action === 'approve'
                ? { note: approvalNotes[authorizationId] || '' }
                : { reason: approvalNotes[authorizationId] || '' }
        );
        setActiveApprovalId('');
        setApprovalNotes((current) => ({ ...current, [authorizationId]: '' }));
        if (response?.success) {
            setNotice(action === 'approve' ? 'Finance workflow approved.' : 'Finance workflow rejected.');
            await loadFinance({ preserveNotice: true });
        } else {
            setNotice(response?.error || 'Finance approval action failed.');
        }
    };

    const incomingPreviewUnit = incomingForm.linked_unit_id ? unitMap.get(incomingForm.linked_unit_id) : null;
    const incomingPreviewProperty = incomingForm.linked_property_id ? propertyMap.get(incomingForm.linked_property_id) : null;
    const bookingPreviewUnit = bookingHoldForm.linked_unit_id ? unitMap.get(bookingHoldForm.linked_unit_id) : null;
    const bookingPreviewProperty = bookingHoldForm.linked_property_id ? propertyMap.get(bookingHoldForm.linked_property_id) : null;
    const onboardingHold = onboardingForm.booking_hold_id ? bookingHoldMap.get(onboardingForm.booking_hold_id) : null;
    const outgoingPreviewWorkOrder = resolveWorkOrderId(outgoingForm.work_order_input)
        ? workOrderMap.get(resolveWorkOrderId(outgoingForm.work_order_input))
        : null;
    const showOutgoingVendorIdField = shouldShowContractField('record_outgoing_txn', 'vendor_id');
    const showOutgoingPayeeField = shouldShowContractField('record_outgoing_txn', 'payee');
    const showOutgoingVendorMode = showOutgoingVendorIdField || showOutgoingPayeeField;
    const formatDisplayDate = (value) => formatTime(value)?.date || String(value || '');
    const formatDisplayDateTime = (value) => {
        const formatted = formatTime(value);
        return formatted ? [formatted.date, formatted.time].filter(Boolean).join(' ') : String(value || '');
    };

    return (
        <div className="h-full overflow-auto bg-slate-100">
            <div className="space-y-6 px-6 py-6">
                <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Finance Operations</p>
                            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Controlled finance workflows</h1>
                            <p className="mt-3 max-w-4xl text-sm text-slate-600">{notice}</p>
                            {financeDataLoading && profileType === 'CEO' ? (
                                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Loading Finance reference data...
                                </p>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/master?context=finance')}
                            className="inline-flex items-center gap-2 self-start rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            <Bot className="h-4 w-4" />
                            Ask Finance AI
                        </button>
                    </div>
                </section>

                {authContextLoading ? (
                    <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-8 text-sm text-slate-500 shadow-sm">
                        Loading finance role context...
                    </section>
                ) : null}

                <div className="inline-flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    {financeTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {!authContextLoading && activeTab === 'overview' && (
                    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]" data-testid="finance-overview-page">
                        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Overview</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                                    {profileType === 'CEO' ? 'Finance snapshot' : profileType === 'Staff' ? 'Assigned unit collections' : 'Your finance access'}
                                </h2>
                            </div>
                            {profileType === 'CEO' ? (
                                <div className="mt-4 flex justify-end">
                                    <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
                                        <span>Period</span>
                                        <select
                                            value={summaryDateRange}
                                            onChange={(event) => setSummaryDateRange(event.target.value)}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                                        >
                                            {summaryDateFilters.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            ) : null}

                            {profileType === 'CEO' ? (
                                <>
                                    <div className="mt-5 grid gap-4 md:grid-cols-5">
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5">
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Inflow</div>
                                            <div className="mt-3 text-3xl font-semibold text-emerald-900">{formatCurrency(summary?.total_inflow)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5">
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Outflow</div>
                                            <div className="mt-3 text-3xl font-semibold text-rose-900">{formatCurrency(summary?.total_outflow)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-5">
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Cash In Hand</div>
                                            <div className="mt-3 text-3xl font-semibold text-teal-900">{formatCurrency(summary?.total_cash_in_hand)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5">
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Outstanding</div>
                                            <div className="mt-3 text-3xl font-semibold text-amber-900">{formatCurrency(summary?.total_outstanding)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-5">
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Booking Holds</div>
                                            <div className="mt-3 text-3xl font-semibold text-sky-900">{summary?.booking_holds_active || 0}</div>
                                        </div>
                                    </div>
                                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                                        Finance workflows can run on any date. Billing still calculates the target billing month using contract validity and prorata where needed.
                                    </div>
                                </>
                            ) : profileType === 'Staff' ? (
                                <div className="mt-5 space-y-3" data-testid="finance-assigned-units">
                                    {assignedUnits.length === 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                            No assigned units with current-month finance context were found.
                                        </div>
                                    ) : assignedUnits.map((unit) => (
                                        <div key={unit.unit_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                                <div>
                                                    <div className="text-lg font-semibold text-slate-900">Unit {unit.unit_number}</div>
                                                    <div className="mt-1 text-sm text-slate-600">Current month: {unit.month_year}</div>
                                                </div>
                                                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                                                    {unit.payment_status}
                                                </div>
                                            </div>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Rent due</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(unit.rent_due)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Deposit due</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(unit.deposit_due)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Received</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(unit.received)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(unit.pending)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    Customers should use CRM, Property booking context, or WhatsApp for their own dues and payment status.
                                </div>
                            )}
                        </section>

                        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="finance-pending-approvals">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pending approvals</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{pendingApprovals.length} open</h2>
                                </div>
                                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                                    Workflow queue
                                </div>
                            </div>

                            <div className="mt-5 space-y-3">
                                {pendingApprovals.length === 0 ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                        No finance approvals are waiting.
                                    </div>
                                ) : pendingApprovals.map((request) => (
                                    <div key={request.authorization_id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                                        <div className="text-sm font-semibold text-slate-900">{request.workflow_id}</div>
                                        <div className="mt-1 text-sm text-slate-600">
                                            Requested by {request.requested_by || 'Unknown'} · {request.requested_by_role || 'Unknown role'}
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500">Created {formatDisplayDateTime(request.created_at)}</div>
                                        <div className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-xs text-slate-600">
                                            <div>Request ID: {request.authorization_id}</div>
                                            {request.args?.payer_id ? <div className="mt-1">Payer: {request.args.payer_id}</div> : null}
                                            {request.args?.linked_unit_id ? <div className="mt-1">Unit: {unitMap.get(request.args.linked_unit_id)?.unit_number || request.args.linked_unit_id}</div> : null}
                                            {request.args?.amount ? <div className="mt-1">Amount: {formatCurrency(request.args.amount)}</div> : null}
                                            {request.args?.payee ? <div className="mt-1">Payee: {request.args.payee}</div> : null}
                                            {request.args?.property_id ? <div className="mt-1">Property: {propertyMap.get(request.args.property_id)?.name || request.args.property_id}</div> : null}
                                        </div>

                                        {profileType === 'CEO' ? (
                                            <div className="mt-3 space-y-3">
                                                <textarea
                                                    aria-label={`Approval note for ${request.authorization_id}`}
                                                    value={approvalNotes[request.authorization_id] || ''}
                                                    onChange={(event) => setApprovalNotes((current) => ({ ...current, [request.authorization_id]: event.target.value }))}
                                                    placeholder="Optional note for approval or rejection"
                                                    className={textareaClasses}
                                                />
                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApproval(request.authorization_id, 'reject')}
                                                        disabled={activeApprovalId === request.authorization_id && requestState === 'approval'}
                                                        className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApproval(request.authorization_id, 'approve')}
                                                        disabled={activeApprovalId === request.authorization_id && requestState === 'approval'}
                                                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                                    >
                                                        Approve
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {!authContextLoading && activeTab === 'incoming' && profileType === 'CEO' && (
                    <div className="space-y-6" data-testid="finance-incoming-tab">
                        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Incoming transactions</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Collections sorted by linked unit when available</h2>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowIncomingModal(true)}
                                        disabled={!ceoFinanceDataReady || financeDataLoading}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                    >
                                        <ArrowDownLeft className="h-4 w-4" />
                                        Add Incoming
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowBookingHoldModal(true)}
                                        disabled={!ceoFinanceDataReady || financeDataLoading}
                                        className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-sky-200 disabled:bg-sky-100/60 disabled:text-sky-500"
                                    >
                                        <Clock3 className="h-4 w-4" />
                                        Record Booking Hold
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowOnboardingModal(true)}
                                        disabled={!ceoFinanceDataReady || financeDataLoading}
                                        className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/60 disabled:text-amber-600"
                                    >
                                        <Workflow className="h-4 w-4" />
                                        Complete Onboarding
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Unit</th>
                                            <th className="px-4 py-3">Payer</th>
                                            <th className="px-4 py-3">Property</th>
                                            <th className="px-4 py-3">Allocation</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Mode</th>
                                            <th className="px-4 py-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {sortedIncomingRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No incoming transactions have been recorded yet.
                                                </td>
                                            </tr>
                                        ) : sortedIncomingRows.map((txn) => (
                                            <tr key={txn.txn_id}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{txn.linked_unit_number || 'Unassigned'}</td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    <div className="font-medium text-slate-900">{resolveLeadName(txn.payer_id) || txn.payer_id}</div>
                                                    {resolveLeadName(txn.payer_id) ? <div className="text-xs text-slate-500">{txn.payer_id}</div> : null}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{propertyMap.get(txn.linked_property_id)?.name || txn.linked_property_id || 'Not linked'}</td>
                                                <td className="px-4 py-3 text-slate-600">{txn.allocations?.length ? `Auto allocation (${txn.allocations.length})` : 'Auto allocation'}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(txn.amount)}</td>
                                                <td className="px-4 py-3 text-slate-600">{txn.payment_mode}</td>
                                                <td className="px-4 py-3 text-slate-600">{txn.date || txn.timestamp ? formatDisplayDate(txn.date || txn.timestamp) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Booking holds</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{activeBookingHolds.length} active</h2>
                                </div>
                                <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
                                    10-day validity
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Booking Hold</th>
                                            <th className="px-4 py-3">Payer</th>
                                            <th className="px-4 py-3">Unit</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Valid Until</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {bookingHolds.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No booking holds exist yet.
                                                </td>
                                            </tr>
                                        ) : bookingHolds.map((hold) => (
                                            <tr key={hold.booking_hold_id}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{hold.booking_hold_id}</td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    <div className="font-medium text-slate-900">{resolveLeadName(hold.payer_id) || hold.payer_id}</div>
                                                    {resolveLeadName(hold.payer_id) ? <div className="text-xs text-slate-500">{hold.payer_id}</div> : null}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{unitMap.get(hold.linked_unit_id)?.unit_number || 'Not assigned'}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(hold.amount)}</td>
                                                <td className="px-4 py-3 text-slate-600">{hold.valid_until ? formatDisplayDate(hold.valid_until) : '-'}</td>
                                                <td className="px-4 py-3 text-slate-600">{hold.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}

                {!authContextLoading && activeTab === 'outgoing' && profileType === 'CEO' && (
                    <div className="space-y-6" data-testid="finance-outgoing-tab">
                        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Outgoing transactions</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Vendor-aware expense tracking</h2>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowOutgoingModal(true)}
                                        disabled={!ceoFinanceDataReady || financeDataLoading}
                                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                                    >
                                        <ArrowUpRight className="h-4 w-4" />
                                        Add Outgoing
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowVendorModal(true)}
                                        disabled={!ceoFinanceDataReady || financeDataLoading}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Vendor
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Vendor / Payee</th>
                                            <th className="px-4 py-3">Property</th>
                                            <th className="px-4 py-3">Work Context</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3">Paid Now</th>
                                            <th className="px-4 py-3">Open Vendor Balance</th>
                                            <th className="px-4 py-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {outgoingRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No outgoing expenses have been recorded yet.
                                                </td>
                                            </tr>
                                        ) : outgoingRows.map((txn) => (
                                            <tr key={txn.txn_id}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{txn.payee}</td>
                                                <td className="px-4 py-3 text-slate-600">{propertyMap.get(txn.property_id)?.name || txn.property_id || 'Not linked'}</td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    <div className="font-medium text-slate-900">{txn.work_title || txn.work_done || 'Not specified'}</div>
                                                    {txn.work_order_id ? <div className="text-xs text-slate-500">{txn.work_order_id}</div> : null}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{txn.category}{txn.sub_category ? ` / ${txn.sub_category}` : ''}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(txn.amount)}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{txn.vendor_open_balance !== null && txn.vendor_open_balance !== undefined ? formatCurrency(txn.vendor_open_balance) : '-'}</td>
                                                <td className="px-4 py-3 text-slate-600">{txn.date || txn.timestamp ? formatDisplayDate(txn.date || txn.timestamp) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}

                {!authContextLoading && activeTab === 'vendors' && profileType === 'CEO' && (
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="finance-vendors-tab">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Vendor register</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Track vendor accounting without giving vendors system access</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowVendorModal(true)}
                                disabled={!ceoFinanceDataReady || financeDataLoading}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                <Landmark className="h-4 w-4" />
                                Add Vendor
                            </button>
                        </div>
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Vendor</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3">Phone</th>
                                        <th className="px-4 py-3">Current Period Paid</th>
                                        <th className="px-4 py-3">Total Paid</th>
                                        <th className="px-4 py-3">Transactions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {vendors.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                                No vendors registered yet.
                                            </td>
                                        </tr>
                                    ) : vendors.map((vendor) => (
                                        <tr key={vendor.vendor_id}>
                                            <td className="px-4 py-3 font-medium text-slate-900">{vendor.vendor_name}</td>
                                            <td className="px-4 py-3 text-slate-600">{vendor.category || 'General'}</td>
                                            <td className="px-4 py-3 text-slate-600">{vendor.primary_phone || '-'}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(vendor.current_period_paid)}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(vendor.total_paid)}</td>
                                            <td className="px-4 py-3 text-slate-600">{vendor.transaction_count || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {!authContextLoading && activeTab === 'activity' && (
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="finance-activity-tab">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow activity</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Recent finance workflow movement</h2>
                            </div>
                            <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                                Observation only
                            </div>
                        </div>
                        <div className="mt-5 space-y-3">
                            {workflowActivity.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    No finance workflow activity has been recorded yet.
                                </div>
                            ) : workflowActivity.map((event) => {
                                const eventType = String(event?.event_type || 'workflow.event');
                                const isPending = eventType.includes('pending') || eventType.includes('requested');
                                const isEnded = eventType.includes('completed') || eventType.includes('approved') || eventType.includes('executed');
                                const Icon = isEnded ? CheckCircle2 : (isPending ? Clock3 : Workflow);
                                return (
                                    <div key={`${event.timestamp}-${eventType}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className={`rounded-full p-2 ${isEnded ? 'bg-emerald-100 text-emerald-700' : (isPending ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700')}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-slate-900">{eventType}</div>
                                            <div className="mt-1 text-sm text-slate-600">{event?.payload?.workflow_id || event?.payload?.tool || 'System activity'}</div>
                                            <div className="mt-1 text-xs text-slate-500">{formatDisplayDateTime(event.timestamp)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            {showIncomingModal && (
                <ModalShell
                    title="Record Incoming Payment"
                    subtitle="Fill the workflow-backed business form below. Finance will still execute only through MasterAI."
                    onClose={() => {
                        setShowIncomingModal(false);
                        clearDynamicContextValues('record_incoming_txn');
                    }}
                >
                    <form onSubmit={handleSubmitIncoming}>
                        {shouldShowContractField('record_incoming_txn', 'payer_id') ? (
                            <FormRow label="Payer / Tenant / Lead" hint="Search by name or phone. Finance still keys the account by payer ID.">
                                <input
                                    aria-label="Payer / Tenant / Lead"
                                    list="finance-leads"
                                    value={incomingForm.payer_input}
                                    onChange={(event) => setIncomingForm((current) => ({ ...current, payer_input: event.target.value }))}
                                    placeholder="Search by name or phone"
                                    className={inputClasses}
                                />
                                <datalist id="finance-leads">
                                    {leadOptions.map((option) => <option key={option.lead_id} value={option.label} />)}
                                </datalist>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_incoming_txn', 'linked_property_id') ? (
                            <FormRow label="Linked Property" hint="Optional. Helps Finance understand the business context quickly.">
                                <select
                                    aria-label="Linked Property"
                                    value={incomingForm.linked_property_id}
                                    onChange={(event) => setIncomingForm((current) => ({
                                        ...current,
                                        linked_property_id: event.target.value,
                                        linked_unit_id: current.linked_unit_id && unitMap.get(current.linked_unit_id)?.property_id !== event.target.value ? '' : current.linked_unit_id,
                                    }))}
                                    className={inputClasses}
                                >
                                    <option value="">Not linked</option>
                                    {referenceProperties.map((property) => (
                                        <option key={property.id} value={property.id}>{property.name}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_incoming_txn', 'linked_unit_id') ? (
                            <FormRow label="Linked Unit" hint="Optional. When available, the incoming list will show and sort by this unit.">
                                <select
                                    aria-label="Linked Unit"
                                    value={incomingForm.linked_unit_id}
                                    onChange={(event) => {
                                        const nextUnitId = event.target.value;
                                        const nextUnit = unitMap.get(nextUnitId);
                                        setIncomingForm((current) => ({
                                            ...current,
                                            linked_unit_id: nextUnitId,
                                            linked_property_id: nextUnit?.property_id || current.linked_property_id,
                                        }));
                                    }}
                                    className={inputClasses}
                                >
                                    <option value="">Not linked</option>
                                    {incomingUnits.map((unit) => (
                                        <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_incoming_txn', 'amount') ? (
                            <FormRow label="Amount" hint="Actual cash received. Allocation will happen underneath.">
                                <input aria-label="Amount" value={incomingForm.amount} onChange={(event) => setIncomingForm((current) => ({ ...current, amount: event.target.value }))} type="number" step="0.01" placeholder="12000" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_incoming_txn', 'payment_mode') ? (
                            <FormRow label="Payment Mode" hint="Use the actual settlement method.">
                                <select aria-label="Payment Mode" value={incomingForm.payment_mode} onChange={(event) => setIncomingForm((current) => ({ ...current, payment_mode: event.target.value }))} className={inputClasses}>
                                    <option value="UPI">UPI</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Payment Gateway">Payment Gateway</option>
                                    <option value="Net Banking">Net Banking</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_incoming_txn', 'date') ? (
                            <FormRow label="Received Date" hint="When the money actually came in.">
                                <DateInputField
                                    ariaLabel="Received Date"
                                    value={incomingForm.date}
                                    onValueChange={(nextValue) => setIncomingForm((current) => ({ ...current, date: nextValue }))}
                                    className={inputClasses}
                                />
                            </FormRow>
                        ) : null}
                        {(shouldShowContractField('record_incoming_txn', 'attachment_url') || shouldShowContractField('record_incoming_txn', 'attachment_urls')) ? (
                            <FormRow label="Evidence" hint="Upload payment proof files. If a readable transaction reference is visible, Finance will fill it below.">
                                <div className="space-y-3">
                                    <label className={uploadButtonClasses}>
                                        {artifactUploads.incoming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                        {artifactUploads.incoming ? 'Uploading...' : 'Upload Files'}
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(event) => {
                                                void uploadArtifacts(event.target.files, 'incoming');
                                                event.target.value = '';
                                            }}
                                        />
                                    </label>
                                    {incomingForm.attachment_urls.length > 0 ? (
                                        <div className="space-y-2">
                                            {incomingForm.attachment_urls.map((url) => (
                                                <div key={url} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                                    <a href={url} target="_blank" rel="noreferrer" className="truncate font-medium hover:text-slate-900 hover:underline">
                                                        {artifactNameFromUrl(url)}
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIncomingForm((current) => ({ ...current, attachment_urls: current.attachment_urls.filter((entry) => entry !== url) }))}
                                                        className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                                                        aria-label="Remove incoming artifact"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_incoming_txn', 'txn_id') ? (
                            <FormRow label="Reference / Txn ID" hint="Auto-filled from uploaded proof when readable. You can still override it if needed.">
                                <input aria-label="Reference / Txn ID" value={incomingForm.txn_id} onChange={(event) => setIncomingForm((current) => ({ ...current, txn_id: event.target.value }))} placeholder="UTR / internal reference" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {(shouldShowContractField('record_incoming_txn', 'note') || shouldShowContractField('record_incoming_txn', 'notes')) ? (
                            <FormRow label="Notes" hint="Business context that helps the CEO validate this workflow quickly.">
                                <textarea aria-label="Notes" value={incomingForm.note} onChange={(event) => setIncomingForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional operator note" className={textareaClasses} />
                            </FormRow>
                        ) : null}
                        {getUnknownContractFields('record_incoming_txn').map((field) => (
                            <FormRow key={`record_incoming_txn-${field.key}`} label={field.label || humanizeContextKey(field.key)} hint={field.hint || 'Field required by active SOP.'}>
                                {renderDynamicFieldInput('record_incoming_txn', field)}
                            </FormRow>
                        ))}
                        <div className="mt-5">
                            <WorkflowPreview
                                title="Workflow Preview"
                                rows={[
                                    { label: 'Workflow', value: getButtonWorkflowId('record_incoming_txn') },
                                    { label: 'Payer', value: resolveLeadPreview(incomingForm.payer_input) || 'Not selected' },
                                    { label: 'Payer ID', value: resolveLeadId(incomingForm.payer_input) || 'Not selected' },
                                    { label: 'Unit', value: incomingPreviewUnit?.unit_number || 'Not linked' },
                                    { label: 'Property', value: incomingPreviewProperty?.name || propertyMap.get(incomingPreviewUnit?.property_id)?.name || 'Not linked' },
                                    { label: 'Allocation', value: 'Finance will allocate automatically using account, ledger, and waterfall rules' },
                                    { label: 'Approval Path', value: 'CEO authorization if required, then workflow execution under MasterAI' },
                                ]}
                            />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => {
                                setShowIncomingModal(false);
                                clearDynamicContextValues('record_incoming_txn');
                            }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                            <button type="submit" disabled={requestState === 'record_incoming_txn'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                Submit Workflow
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {showBookingHoldModal && (
                <ModalShell
                    title="Record Booking Hold"
                    subtitle="Booking money is held first, not treated as normal rent collection."
                    onClose={() => {
                        setShowBookingHoldModal(false);
                        clearDynamicContextValues('record_booking_hold');
                    }}
                >
                    <form onSubmit={handleSubmitBookingHold}>
                        {shouldShowContractField('record_booking_hold', 'payer_id') ? (
                            <FormRow label="Payer / Lead" hint="Search by name or phone. Booking hold stays attached to the payer account.">
                                <input
                                    aria-label="Payer / Lead"
                                    list="finance-leads"
                                    value={bookingHoldForm.payer_input}
                                    onChange={(event) => setBookingHoldForm((current) => ({ ...current, payer_input: event.target.value }))}
                                    placeholder="Search by name or phone"
                                    className={inputClasses}
                                />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_booking_hold', 'linked_property_id') ? (
                            <FormRow label="Linked Property" hint="Optional at this stage. Useful when a preferred property is already known.">
                                <select
                                    aria-label="Linked Property for Booking Hold"
                                    value={bookingHoldForm.linked_property_id}
                                    onChange={(event) => setBookingHoldForm((current) => ({
                                        ...current,
                                        linked_property_id: event.target.value,
                                        linked_unit_id: current.linked_unit_id && unitMap.get(current.linked_unit_id)?.property_id !== event.target.value ? '' : current.linked_unit_id,
                                    }))}
                                    className={inputClasses}
                                >
                                    <option value="">Not linked</option>
                                    {referenceProperties.map((property) => (
                                        <option key={property.id} value={property.id}>{property.name}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_booking_hold', 'linked_unit_id') ? (
                            <FormRow label="Linked Unit" hint="Optional until final onboarding is completed.">
                                <select
                                    aria-label="Linked Unit for Booking Hold"
                                    value={bookingHoldForm.linked_unit_id}
                                    onChange={(event) => {
                                        const nextUnitId = event.target.value;
                                        const nextUnit = unitMap.get(nextUnitId);
                                        setBookingHoldForm((current) => ({
                                            ...current,
                                            linked_unit_id: nextUnitId,
                                            linked_property_id: nextUnit?.property_id || current.linked_property_id,
                                        }));
                                    }}
                                    className={inputClasses}
                                >
                                    <option value="">Not linked</option>
                                    {bookingHoldUnits.map((unit) => (
                                        <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_booking_hold', 'amount') ? (
                            <FormRow label="Booking Amount" hint="Money received to hold the booking before onboarding.">
                                <input aria-label="Booking Amount" value={bookingHoldForm.amount} onChange={(event) => setBookingHoldForm((current) => ({ ...current, amount: event.target.value }))} type="number" step="0.01" placeholder="5000" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_booking_hold', 'payment_mode') ? (
                            <FormRow label="Payment Mode" hint="Record the actual way money came in.">
                                <select aria-label="Booking Hold Payment Mode" value={bookingHoldForm.payment_mode} onChange={(event) => setBookingHoldForm((current) => ({ ...current, payment_mode: event.target.value }))} className={inputClasses}>
                                    <option value="UPI">UPI</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Payment Gateway">Payment Gateway</option>
                                    <option value="Net Banking">Net Banking</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_booking_hold', 'received_at') ? (
                            <FormRow label="Received Date" hint="Actual date cash was received.">
                                <DateInputField
                                    ariaLabel="Booking Hold Received Date"
                                    value={bookingHoldForm.received_at}
                                    onValueChange={(nextValue) => setBookingHoldForm((current) => ({ ...current, received_at: nextValue }))}
                                    className={inputClasses}
                                />
                            </FormRow>
                        ) : null}
                        {(shouldShowContractField('record_booking_hold', 'evidence_link') || shouldShowContractField('record_booking_hold', 'attachment_url')) ? (
                            <FormRow label="Evidence" hint="Upload booking proof or supporting artifacts. Multiple files are allowed.">
                                <div className="space-y-3">
                                    <label className={uploadButtonClasses}>
                                        {artifactUploads.bookingHold ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                        {artifactUploads.bookingHold ? 'Uploading...' : 'Upload Files'}
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(event) => {
                                                void uploadArtifacts(event.target.files, 'bookingHold');
                                                event.target.value = '';
                                            }}
                                        />
                                    </label>
                                    {bookingHoldForm.evidence_links.length > 0 ? (
                                        <div className="space-y-2">
                                            {bookingHoldForm.evidence_links.map((url) => (
                                                <div key={url} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                                    <a href={url} target="_blank" rel="noreferrer" className="truncate font-medium hover:text-slate-900 hover:underline">
                                                        {artifactNameFromUrl(url)}
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => setBookingHoldForm((current) => ({ ...current, evidence_links: current.evidence_links.filter((entry) => entry !== url) }))}
                                                        className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                                                        aria-label="Remove booking artifact"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </FormRow>
                        ) : null}
                        {(shouldShowContractField('record_booking_hold', 'notes') || shouldShowContractField('record_booking_hold', 'note')) ? (
                            <FormRow label="Notes" hint="The booking hold expires after 10 days if onboarding does not complete.">
                                <textarea aria-label="Booking Hold Notes" value={bookingHoldForm.notes} onChange={(event) => setBookingHoldForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional note" className={textareaClasses} />
                            </FormRow>
                        ) : null}
                        {getUnknownContractFields('record_booking_hold').map((field) => (
                            <FormRow key={`record_booking_hold-${field.key}`} label={field.label || humanizeContextKey(field.key)} hint={field.hint || 'Field required by active SOP.'}>
                                {renderDynamicFieldInput('record_booking_hold', field)}
                            </FormRow>
                        ))}
                        <div className="mt-5">
                            <WorkflowPreview
                                title="Workflow Preview"
                                rows={[
                                    { label: 'Workflow', value: getButtonWorkflowId('record_booking_hold') },
                                    { label: 'Payer', value: resolveLeadPreview(bookingHoldForm.payer_input) || 'Not selected' },
                                    { label: 'Payer ID', value: resolveLeadId(bookingHoldForm.payer_input) || 'Not selected' },
                                    { label: 'Property', value: bookingPreviewProperty?.name || 'Not linked' },
                                    { label: 'Unit', value: bookingPreviewUnit?.unit_number || 'Not linked' },
                                    { label: 'Validity Rule', value: '10-day booking hold; expires with no refund if onboarding does not complete' },
                                    { label: 'Commercial Effect', value: 'No rent ledger starts yet' },
                                ]}
                            />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => {
                                setShowBookingHoldModal(false);
                                clearDynamicContextValues('record_booking_hold');
                            }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                            <button type="submit" disabled={requestState === 'record_booking_hold'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                Submit Workflow
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {showOnboardingModal && (
                <ModalShell
                    title="Complete Onboarding From Booking"
                    subtitle="CEO enters the onboarding date. Booking money is then applied commercially from that date."
                    onClose={() => {
                        setShowOnboardingModal(false);
                        clearDynamicContextValues('complete_onboarding_from_booking');
                    }}
                >
                    <form onSubmit={handleSubmitOnboarding}>
                        {shouldShowContractField('complete_onboarding_from_booking', 'booking_hold_id') ? (
                            <FormRow label="Booking Hold" hint="Only active booking holds can be converted into onboarding.">
                                <select
                                    aria-label="Booking Hold"
                                    value={onboardingForm.booking_hold_id}
                                    onChange={(event) => {
                                        const nextHold = bookingHoldMap.get(event.target.value);
                                        setOnboardingForm((current) => ({
                                            ...current,
                                            booking_hold_id: event.target.value,
                                            lead_input: nextHold?.payer_id || current.lead_input,
                                            property_id: nextHold?.linked_property_id || current.property_id,
                                            unit_id: nextHold?.linked_unit_id || current.unit_id,
                                            security_deposit: nextHold?.amount ? String(nextHold.amount) : current.security_deposit,
                                        }));
                                    }}
                                    className={inputClasses}
                                >
                                    <option value="">Select booking hold</option>
                                    {activeBookingHolds.map((hold) => (
                                        <option key={hold.booking_hold_id} value={hold.booking_hold_id}>
                                            {hold.booking_hold_id} · {hold.payer_id} · {formatCurrency(hold.amount)}
                                        </option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'lead_id') ? (
                            <FormRow label="Payer / Lead" hint="Search by name or phone. Usually auto-fills from the booking hold.">
                                <input
                                    aria-label="Onboarding Payer / Lead"
                                    list="finance-leads"
                                    value={onboardingForm.lead_input}
                                    onChange={(event) => setOnboardingForm((current) => ({ ...current, lead_input: event.target.value }))}
                                    placeholder="Search by name or phone"
                                    className={inputClasses}
                                />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'property_id') ? (
                            <FormRow label="Assigned Property" hint="Final property context for onboarding.">
                                <select
                                    aria-label="Assigned Property"
                                    value={onboardingForm.property_id}
                                    onChange={(event) => setOnboardingForm((current) => ({
                                        ...current,
                                        property_id: event.target.value,
                                        unit_id: current.unit_id && unitMap.get(current.unit_id)?.property_id !== event.target.value ? '' : current.unit_id,
                                    }))}
                                    className={inputClasses}
                                >
                                    <option value="">Select property</option>
                                    {referenceProperties.map((property) => (
                                        <option key={property.id} value={property.id}>{property.name}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'unit_id') ? (
                            <FormRow label="Assigned Unit" hint="This becomes the live occupancy unit once the workflow executes.">
                                <select
                                    aria-label="Assigned Unit"
                                    value={onboardingForm.unit_id}
                                    onChange={(event) => {
                                        const nextUnitId = event.target.value;
                                        const nextUnit = unitMap.get(nextUnitId);
                                        setOnboardingForm((current) => ({
                                            ...current,
                                            unit_id: nextUnitId,
                                            property_id: nextUnit?.property_id || current.property_id,
                                        }));
                                    }}
                                    className={inputClasses}
                                >
                                    <option value="">Select unit</option>
                                    {onboardingUnits.map((unit) => (
                                        <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'onboarding_date') ? (
                            <FormRow label="Onboarding Date" hint="CEO-controlled. Can be backdated. This does not change when billing workflow runs.">
                                <DateInputField
                                    ariaLabel="Onboarding Date"
                                    value={onboardingForm.onboarding_date}
                                    onValueChange={(nextValue) => setOnboardingForm((current) => ({ ...current, onboarding_date: nextValue }))}
                                    className={inputClasses}
                                />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'negotiated_rent') ? (
                            <FormRow label="Negotiated Rent" hint="This becomes the contract rent for the new onboarding context.">
                                <input aria-label="Negotiated Rent" value={onboardingForm.negotiated_rent} onChange={(event) => setOnboardingForm((current) => ({ ...current, negotiated_rent: event.target.value }))} type="number" step="0.01" placeholder="12000" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'security_deposit') ? (
                            <FormRow label="Security Deposit" hint="Use the agreed deposit, not a guessed value.">
                                <input aria-label="Security Deposit" value={onboardingForm.security_deposit} onChange={(event) => setOnboardingForm((current) => ({ ...current, security_deposit: event.target.value }))} type="number" step="0.01" placeholder="5000" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'rent_payment_timing') ? (
                            <FormRow label="Rent Payment Timing" hint="Commercial contract rule for rent timing.">
                                <select aria-label="Rent Payment Timing" value={onboardingForm.rent_payment_timing} onChange={(event) => setOnboardingForm((current) => ({ ...current, rent_payment_timing: event.target.value }))} className={inputClasses}>
                                    <option value="ADVANCE">Advance</option>
                                    <option value="ARREARS">Arrears</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('complete_onboarding_from_booking', 'utility_payment_timing') ? (
                            <FormRow label="Utility Payment Timing" hint="Commercial contract rule for utilities.">
                                <select aria-label="Utility Payment Timing" value={onboardingForm.utility_payment_timing} onChange={(event) => setOnboardingForm((current) => ({ ...current, utility_payment_timing: event.target.value }))} className={inputClasses}>
                                    <option value="ADVANCE">Advance</option>
                                    <option value="ARREARS">Arrears</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {getUnknownContractFields('complete_onboarding_from_booking').map((field) => (
                            <FormRow key={`complete_onboarding_from_booking-${field.key}`} label={field.label || humanizeContextKey(field.key)} hint={field.hint || 'Field required by active SOP.'}>
                                {renderDynamicFieldInput('complete_onboarding_from_booking', field)}
                            </FormRow>
                        ))}
                        <div className="mt-5">
                            <WorkflowPreview
                                title="Workflow Preview"
                                rows={[
                                    { label: 'Workflow', value: getButtonWorkflowId('complete_onboarding_from_booking') },
                                    { label: 'Booking Hold', value: onboardingForm.booking_hold_id || 'Not selected' },
                                    { label: 'Payer', value: resolveLeadPreview(onboardingForm.lead_input) || 'Not selected' },
                                    { label: 'Payer ID', value: resolveLeadId(onboardingForm.lead_input) || 'Not selected' },
                                    { label: 'Assigned Unit', value: unitMap.get(onboardingForm.unit_id)?.unit_number || 'Not selected' },
                                    { label: 'Onboarding Date', value: onboardingForm.onboarding_date || 'Not set' },
                                    { label: 'Booking Hold Rule', value: onboardingHold ? `Held money of ${formatCurrency(onboardingHold.amount)} will apply commercially from onboarding date` : 'Select a booking hold to preview application' },
                                ]}
                            />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => {
                                setShowOnboardingModal(false);
                                clearDynamicContextValues('complete_onboarding_from_booking');
                            }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                            <button type="submit" disabled={requestState === 'complete_onboarding_from_booking'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                Submit Workflow
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {showOutgoingModal && (
                <ModalShell
                    title="Record Outgoing Transaction"
                    subtitle="Record the real-world outgoing once. Finance will place it under the correct work context underneath, but it will ask for more detail instead of guessing."
                    onClose={() => {
                        setShowOutgoingModal(false);
                        clearDynamicContextValues('record_outgoing_txn');
                    }}
                >
                    <form onSubmit={handleSubmitOutgoing}>
                        {shouldShowContractField('record_outgoing_txn', 'property_id') ? (
                            <FormRow label="Property" hint="All outgoing entries should be linked to the relevant asset when possible.">
                                <select aria-label="Outgoing Property" value={outgoingForm.property_id} onChange={(event) => setOutgoingForm((current) => ({ ...current, property_id: event.target.value }))} className={inputClasses}>
                                    <option value="">Select property</option>
                                    {referenceProperties.map((property) => (
                                        <option key={property.id} value={property.id}>{property.name}</option>
                                    ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'unit_id') ? (
                            <FormRow label="Linked Unit" hint="Optional. Use this when the spend clearly belongs to one unit or room.">
                                <select aria-label="Outgoing Unit" value={outgoingForm.unit_id} onChange={(event) => setOutgoingForm((current) => ({ ...current, unit_id: event.target.value }))} className={inputClasses}>
                                    <option value="">Not unit-specific</option>
                                    {referenceUnits
                                        .filter((unit) => !outgoingForm.property_id || unit.property_id === outgoingForm.property_id)
                                        .map((unit) => (
                                            <option key={unit.id} value={unit.id}>
                                                Unit {unit.unit_number}
                                            </option>
                                        ))}
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'category') ? (
                            <FormRow label="Category" hint="Use the business classification that will matter in reporting later.">
                                <select aria-label="Outgoing Category" value={outgoingForm.category} onChange={(event) => setOutgoingForm((current) => ({ ...current, category: event.target.value }))} className={inputClasses}>
                                    <option value="OpEx">OpEx</option>
                                    <option value="CapEx">CapEx</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'sub_category') ? (
                            <FormRow label="Sub-category" hint="Keep this business-readable: plumbing, cleaning, repairs, electricity, and so on.">
                                <input aria-label="Outgoing Sub-category" value={outgoingForm.sub_category} onChange={(event) => setOutgoingForm((current) => ({ ...current, sub_category: event.target.value }))} placeholder="Plumbing / Housekeeping / Electrical" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'work_order_id') ? (
                            <FormRow label="Existing Work Context" hint="Optional. Select this when the outgoing belongs to a work already started earlier. Leave blank to let Finance create a new work context from the details below.">
                                <input
                                    aria-label="Existing Work Context"
                                    list="finance-work-orders"
                                    value={outgoingForm.work_order_input}
                                    onChange={(event) => setOutgoingForm((current) => ({ ...current, work_order_input: event.target.value }))}
                                    placeholder="Search work title or work ID"
                                    className={inputClasses}
                                />
                                <datalist id="finance-work-orders">
                                    {workOrderOptions.map((option) => <option key={option.work_order_id} value={option.label} />)}
                                </datalist>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'work_title') ? (
                            <FormRow label="Work Title" hint="Use a short business name such as 'Unit 201 plumbing repair' or 'Front gate welding'.">
                                <input aria-label="Work Title" value={outgoingForm.work_title} onChange={(event) => setOutgoingForm((current) => ({ ...current, work_title: event.target.value }))} placeholder="Short work title" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {showOutgoingVendorMode ? (
                            <FormRow label="Vendor / Payee Mode" hint="Prefer registered vendors. Use one-off payee only when needed.">
                                <select aria-label="Vendor / Payee Mode" value={outgoingForm.vendor_mode} onChange={(event) => setOutgoingForm((current) => ({ ...current, vendor_mode: event.target.value }))} className={inputClasses}>
                                    {showOutgoingVendorIdField ? <option value="registered">Registered Vendor</option> : null}
                                    {showOutgoingPayeeField ? <option value="one_off">One-off Payee</option> : null}
                                </select>
                            </FormRow>
                        ) : null}
                        {showOutgoingVendorIdField && (outgoingForm.vendor_mode === 'registered' || !showOutgoingPayeeField) ? (
                            <FormRow label="Registered Vendor" hint="Search the vendor register here, or add a vendor first.">
                                <div className="flex gap-3">
                                    <input
                                        aria-label="Registered Vendor"
                                        list="finance-vendors"
                                        value={outgoingForm.vendor_input}
                                        onChange={(event) => setOutgoingForm((current) => ({ ...current, vendor_input: event.target.value }))}
                                        placeholder="Search vendor"
                                        className={inputClasses}
                                    />
                                    <button type="button" onClick={() => setShowVendorModal(true)} className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        Add Vendor
                                    </button>
                                    <datalist id="finance-vendors">
                                        {vendorOptions.map((option) => <option key={option.vendor_id} value={option.label} />)}
                                    </datalist>
                                </div>
                            </FormRow>
                        ) : null}
                        {showOutgoingPayeeField && (outgoingForm.vendor_mode === 'one_off' || !showOutgoingVendorIdField) ? (
                            <FormRow label="One-off Payee" hint="Use this only when the payee should not be a tracked vendor yet.">
                                <input aria-label="One-off Payee" value={outgoingForm.payee} onChange={(event) => setOutgoingForm((current) => ({ ...current, payee: event.target.value }))} placeholder="Vendor / payee name" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'work_done') ? (
                            <FormRow label="Work Summary" hint="Short business description of why money is going out, especially useful if this is a new work context.">
                                <textarea aria-label="Work Done" value={outgoingForm.work_done} onChange={(event) => setOutgoingForm((current) => ({ ...current, work_done: event.target.value }))} placeholder="Describe the work or business reason" className={textareaClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'line_items') ? (
                            <FormRow label="Line Items" hint="Add actual material or service rows when this payment includes fresh purchase or work done now. Leave them blank if this is only a payment against an already-open work context.">
                                <div className="space-y-3">
                                    {outgoingForm.line_items.map((item, index) => (
                                        <div key={`outgoing-line-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.5fr_110px_140px_140px_auto]">
                                            <input
                                                aria-label={`Line Item ${index + 1} Name`}
                                                value={item.item_name}
                                                onChange={(event) => updateOutgoingLineItem(index, 'item_name', event.target.value)}
                                                placeholder="Item / service"
                                                className={inputClasses}
                                            />
                                            <input
                                                aria-label={`Line Item ${index + 1} Quantity`}
                                                value={item.quantity}
                                                onChange={(event) => updateOutgoingLineItem(index, 'quantity', event.target.value)}
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder="Qty"
                                                className={inputClasses}
                                            />
                                            <input
                                                aria-label={`Line Item ${index + 1} Unit Price`}
                                                value={item.unit_price}
                                                onChange={(event) => updateOutgoingLineItem(index, 'unit_price', event.target.value)}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="Unit price"
                                                className={inputClasses}
                                            />
                                            <input
                                                aria-label={`Line Item ${index + 1} Line Total`}
                                                value={item.line_total}
                                                onChange={(event) => updateOutgoingLineItem(index, 'line_total', event.target.value)}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="Line total"
                                                className={inputClasses}
                                            />
                                            <button type="button" onClick={() => removeOutgoingLineItem(index)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addOutgoingLineItem} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        Add Line Item
                                    </button>
                                </div>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'amount') ? (
                            <FormRow label="Amount Paid Now" hint="Actual cash or bank amount paid in this transaction. This may be one installment under a larger work.">
                                <input aria-label="Outgoing Amount" value={outgoingForm.amount} onChange={(event) => setOutgoingForm((current) => ({ ...current, amount: event.target.value }))} type="number" step="0.01" placeholder="2500" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'payment_mode') ? (
                            <FormRow label="Payment Mode" hint="Settlement mode actually used.">
                                <select aria-label="Outgoing Payment Mode" value={outgoingForm.payment_mode} onChange={(event) => setOutgoingForm((current) => ({ ...current, payment_mode: event.target.value }))} className={inputClasses}>
                                    <option value="UPI">UPI</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Net Banking">Net Banking</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'date') ? (
                            <FormRow label="Expense Date" hint="Date of the actual outgoing settlement.">
                                <DateInputField
                                    ariaLabel="Expense Date"
                                    value={outgoingForm.date}
                                    onValueChange={(nextValue) => setOutgoingForm((current) => ({ ...current, date: nextValue }))}
                                    className={inputClasses}
                                />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'attachment_urls') ? (
                            <FormRow label="Evidence" hint="Upload bill images, settlement proof, or vendor artifacts. Multiple files are allowed.">
                                <div className="space-y-3">
                                    <label className={uploadButtonClasses}>
                                        {artifactUploads.outgoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                        {artifactUploads.outgoing ? 'Uploading...' : 'Upload Files'}
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(event) => {
                                                const files = event.target.files;
                                                uploadArtifacts(files, 'outgoing');
                                                event.target.value = '';
                                            }}
                                        />
                                    </label>
                                    {outgoingForm.attachment_urls.length > 0 ? (
                                        <div className="space-y-2">
                                            {outgoingForm.attachment_urls.map((url) => (
                                                <div key={url} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                                    <a href={url} target="_blank" rel="noreferrer" className="truncate font-medium hover:text-slate-900 hover:underline">
                                                        {artifactNameFromUrl(url)}
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOutgoingForm((current) => ({ ...current, attachment_urls: current.attachment_urls.filter((entry) => entry !== url) }))}
                                                        className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                                                        aria-label="Remove outgoing artifact"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('record_outgoing_txn', 'remarks') ? (
                            <FormRow label="Remarks" hint="Optional operator remark for approval context.">
                                <textarea aria-label="Remarks" value={outgoingForm.remarks} onChange={(event) => setOutgoingForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Optional finance remark" className={textareaClasses} />
                            </FormRow>
                        ) : null}
                        {getUnknownContractFields('record_outgoing_txn').map((field) => (
                            <FormRow key={`record_outgoing_txn-${field.key}`} label={field.label || humanizeContextKey(field.key)} hint={field.hint || 'Field required by active SOP.'}>
                                {renderDynamicFieldInput('record_outgoing_txn', field)}
                            </FormRow>
                        ))}
                        <div className="mt-5">
                            <WorkflowPreview
                                title="Workflow Preview"
                                rows={[
                                    { label: 'Workflow', value: getButtonWorkflowId('record_outgoing_txn') },
                                    { label: 'Property', value: propertyMap.get(outgoingForm.property_id)?.name || 'Not selected' },
                                    { label: 'Unit', value: unitMap.get(outgoingForm.unit_id)?.unit_number ? `Unit ${unitMap.get(outgoingForm.unit_id)?.unit_number}` : '' },
                                    { label: 'Existing Work', value: outgoingPreviewWorkOrder ? `${outgoingPreviewWorkOrder.work_title} (${outgoingPreviewWorkOrder.work_order_id})` : '' },
                                    { label: 'Work Title', value: outgoingForm.work_title || 'Not entered' },
                                    { label: 'Payee', value: outgoingForm.vendor_mode === 'registered' ? (vendorMap.get(resolveVendorId(outgoingForm.vendor_input))?.vendor_name || 'Not selected') : (outgoingForm.payee || 'Not entered') },
                                    { label: 'Category', value: outgoingForm.category + (outgoingForm.sub_category ? ` / ${outgoingForm.sub_category}` : '') },
                                    { label: 'Amount Paid', value: outgoingForm.amount ? formatCurrency(outgoingForm.amount) : 'Not entered' },
                                    { label: 'Line Items', value: String((outgoingForm.line_items || []).filter((item) => String(item.item_name || '').trim()).length || 0) },
                                    { label: 'Approval Path', value: 'CEO authorization if required, then workflow execution under MasterAI' },
                                ]}
                            />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => {
                                setShowOutgoingModal(false);
                                clearDynamicContextValues('record_outgoing_txn');
                            }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                            <button type="submit" disabled={requestState === 'record_outgoing_txn'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                Submit Workflow
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {showVendorModal && (
                <ModalShell
                    title="Add Vendor"
                    subtitle="Vendors do not use the portal directly, but their accounting should still stay controlled and traceable."
                    onClose={() => {
                        setShowVendorModal(false);
                        clearDynamicContextValues('add_vendor');
                    }}
                >
                    <form onSubmit={handleSubmitVendor}>
                        {shouldShowContractField('add_vendor', 'vendor_name') ? (
                            <FormRow label="Vendor Name" hint="Use the clear business name you expect to see in outgoing spend reports.">
                                <input aria-label="Vendor Name" value={vendorForm.vendor_name} onChange={(event) => setVendorForm((current) => ({ ...current, vendor_name: event.target.value }))} placeholder="Vendor / payee name" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'category') ? (
                            <FormRow label="Category" hint="Helps group vendor payments in Finance.">
                                <select aria-label="Vendor Category" value={vendorForm.category} onChange={(event) => setVendorForm((current) => ({ ...current, category: event.target.value }))} className={inputClasses}>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Housekeeping">Housekeeping</option>
                                    <option value="Utilities">Utilities</option>
                                    <option value="Operations">Operations</option>
                                    <option value="Security">Security</option>
                                    <option value="General">General</option>
                                </select>
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'primary_phone') ? (
                            <FormRow label="Primary Phone" hint="Optional, but useful for later vendor search.">
                                <input aria-label="Vendor Primary Phone" value={vendorForm.primary_phone} onChange={(event) => setVendorForm((current) => ({ ...current, primary_phone: event.target.value }))} placeholder="+91..." className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'email') ? (
                            <FormRow label="Email" hint="Optional. Finance can still track the vendor without direct system access.">
                                <input aria-label="Vendor Email" value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} placeholder="vendor@example.com" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'upi_id') ? (
                            <FormRow label="UPI ID" hint="Optional payout reference for operational ease.">
                                <input aria-label="Vendor UPI ID" value={vendorForm.upi_id} onChange={(event) => setVendorForm((current) => ({ ...current, upi_id: event.target.value }))} placeholder="vendor@upi" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'bank_details') ? (
                            <FormRow label="Bank Name" hint="Optional bank reference for vendor accounting.">
                                <input aria-label="Vendor Bank Name" value={vendorForm.bank_name} onChange={(event) => setVendorForm((current) => ({ ...current, bank_name: event.target.value }))} placeholder="HDFC Bank" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'bank_details') ? (
                            <FormRow label="Account Holder" hint="Only fill when banking details are actually maintained for this vendor.">
                                <input aria-label="Vendor Account Holder" value={vendorForm.account_holder} onChange={(event) => setVendorForm((current) => ({ ...current, account_holder: event.target.value }))} placeholder="Account holder name" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'bank_details') ? (
                            <FormRow label="Account Number" hint="Optional bank account number for vendor records.">
                                <input aria-label="Vendor Account Number" value={vendorForm.account_number} onChange={(event) => setVendorForm((current) => ({ ...current, account_number: event.target.value }))} placeholder="1234567890" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'bank_details') ? (
                            <FormRow label="IFSC" hint="Optional bank branch code.">
                                <input aria-label="Vendor IFSC" value={vendorForm.ifsc} onChange={(event) => setVendorForm((current) => ({ ...current, ifsc: event.target.value }))} placeholder="HDFC0001234" className={inputClasses} />
                            </FormRow>
                        ) : null}
                        {shouldShowContractField('add_vendor', 'notes') ? (
                            <FormRow label="Notes" hint="Useful for vendor context, payment terms, or internal accounting remarks.">
                                <textarea aria-label="Vendor Notes" value={vendorForm.notes} onChange={(event) => setVendorForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional vendor note" className={textareaClasses} />
                            </FormRow>
                        ) : null}
                        {getUnknownContractFields('add_vendor').map((field) => (
                            <FormRow key={`add_vendor-${field.key}`} label={field.label || humanizeContextKey(field.key)} hint={field.hint || 'Field required by active SOP.'}>
                                {renderDynamicFieldInput('add_vendor', field)}
                            </FormRow>
                        ))}
                        <div className="mt-5">
                            <WorkflowPreview
                                title="Workflow Preview"
                                rows={[
                                    { label: 'Workflow', value: getButtonWorkflowId('add_vendor') },
                                    { label: 'Vendor', value: vendorForm.vendor_name || 'Not entered' },
                                    { label: 'Category', value: vendorForm.category },
                                    { label: 'Usage', value: 'Vendor becomes selectable from outgoing workflows and spend tracking' },
                                ]}
                            />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => {
                                setShowVendorModal(false);
                                clearDynamicContextValues('add_vendor');
                            }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                            <button type="submit" disabled={requestState === 'add_vendor'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                Submit Workflow
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
};

export default FinancePage;
