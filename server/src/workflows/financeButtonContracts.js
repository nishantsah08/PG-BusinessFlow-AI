const { FINANCIAL_MUTATION_TOOL_TO_WORKFLOW } = require('./financialWorkflowPolicy');
const { resolveEffectiveWorkflow } = require('./workflowGovernance');

const FINANCE_BUTTON_ACTIONS = [
    {
        action_id: 'add_incoming',
        button_label: 'Add Incoming',
        tool_name: 'record_incoming_txn',
        required_context_keys: ['payer_id', 'amount'],
        smart_behavior: [
            'Payer field supports search by name or phone.',
            'Selecting unit can auto-align property context.',
            'Unit options are filtered by selected property.'
        ],
    },
    {
        action_id: 'record_booking_hold',
        button_label: 'Record Booking Hold',
        tool_name: 'record_booking_hold',
        required_context_keys: ['payer_id', 'amount'],
        smart_behavior: [
            'Payer field supports search by name or phone.',
            'Linked unit is optional and can be changed later during onboarding.',
            'Unit options are filtered by selected property.'
        ],
    },
    {
        action_id: 'complete_onboarding',
        button_label: 'Complete Onboarding',
        tool_name: 'complete_onboarding_from_booking',
        required_context_keys: ['booking_hold_id', 'lead_id', 'onboarding_date', 'negotiated_rent'],
        smart_behavior: [
            'Selecting booking hold auto-fills payer, property, unit, and deposit context.',
            'Assigned unit can be overridden as final onboarding unit.',
            'Final unit selection updates booking-hold linkage for audit continuity.'
        ],
    },
    {
        action_id: 'add_outgoing',
        button_label: 'Add Outgoing',
        tool_name: 'record_outgoing_txn',
        required_context_keys: ['property_id', 'amount'],
        any_of_context_keys: [['vendor_id', 'payee']],
        smart_behavior: [
            'Vendor can be selected from register or provided as a direct payee.',
            'Work context can be existing order or new title; system asks follow-up instead of guessing.',
            'Unit options are filtered by selected property.'
        ],
    },
    {
        action_id: 'add_vendor',
        button_label: 'Add Vendor',
        tool_name: 'add_vendor',
        required_context_keys: ['vendor_name'],
        smart_behavior: [
            'Vendor name is required before submit.',
            'Phone/UPI/Bank details can be captured when available.',
            'Existing vendor reuse is preferred over duplicate records.'
        ],
    },
];

const CONTEXT_FIELD_PRESETS = {
    payer_id: {
        label: 'Payer / Lead',
        source: 'lead_lookup',
        hint: 'Search by name or phone.',
    },
    lead_id: {
        label: 'Payer / Lead',
        source: 'lead_lookup',
        hint: 'Search by name or phone.',
    },
    booking_hold_id: {
        label: 'Booking Hold',
        source: 'booking_hold_select',
        hint: 'Select an active booking hold to continue.',
    },
    linked_property_id: {
        label: 'Linked Property',
        source: 'property_select',
        hint: 'Optional property context for this transaction.',
    },
    property_id: {
        label: 'Property',
        source: 'property_select',
        hint: 'Select the related property.',
    },
    linked_unit_id: {
        label: 'Linked Unit',
        source: 'unit_select',
        depends_on: 'linked_property_id',
        hint: 'Optional. Unit options are filtered by property.',
    },
    unit_id: {
        label: 'Unit',
        source: 'unit_select',
        depends_on: 'property_id',
        hint: 'Unit options are filtered by property.',
    },
    date: {
        label: 'Date',
        source: 'date_input',
    },
    received_at: {
        label: 'Received Date',
        source: 'date_input',
    },
    onboarding_date: {
        label: 'Onboarding Date',
        source: 'date_input',
    },
    payment_mode: {
        label: 'Payment Mode',
        source: 'enum_select',
    },
    category: {
        label: 'Category',
        source: 'enum_select',
    },
    rent_payment_timing: {
        label: 'Rent Payment Timing',
        source: 'enum_select',
    },
    utility_payment_timing: {
        label: 'Utility Payment Timing',
        source: 'enum_select',
    },
    vendor_id: {
        label: 'Vendor',
        source: 'vendor_select',
    },
    payee: {
        label: 'One-off Payee',
        source: 'text_input',
    },
    work_order_id: {
        label: 'Existing Work Context',
        source: 'work_order_select',
    },
    work_title: {
        label: 'Work Title',
        source: 'text_input',
    },
    work_done: {
        label: 'Work Summary',
        source: 'textarea',
    },
    sub_category: {
        label: 'Sub-category',
        source: 'text_input',
    },
    remarks: {
        label: 'Remarks',
        source: 'textarea',
    },
    note: {
        label: 'Notes',
        source: 'textarea',
    },
    notes: {
        label: 'Notes',
        source: 'textarea',
    },
    attachment_url: {
        label: 'Evidence',
        source: 'file_single',
    },
    evidence_link: {
        label: 'Evidence',
        source: 'file_single',
    },
    attachment_urls: {
        label: 'Evidence',
        source: 'file_multi',
    },
    line_items: {
        label: 'Line Items',
        source: 'line_items',
    },
    vendor_name: {
        label: 'Vendor Name',
        source: 'text_input',
    },
    primary_phone: {
        label: 'Primary Phone',
        source: 'text_input',
    },
    email: {
        label: 'Email',
        source: 'text_input',
    },
    upi_id: {
        label: 'UPI ID',
        source: 'text_input',
    },
    bank_details: {
        label: 'Bank Details',
        source: 'json_editor',
    },
    context_type: {
        label: 'Collection Context',
        source: 'enum_select',
    },
};

const DEFAULT_ENUMS_BY_KEY = {
    payment_mode: ['UPI', 'Cash', 'Payment Gateway', 'Net Banking', 'Cheque'],
    category: ['OpEx', 'CapEx'],
    rent_payment_timing: ['ADVANCE', 'ARREARS'],
    utility_payment_timing: ['ADVANCE', 'ARREARS'],
    context_type: ['RENT_COLLECTION', 'BOOKING_HOLD'],
};

function extractContextKeys(params = {}) {
    const keys = new Set();
    Object.values(params || {}).forEach((value) => {
        const match = typeof value === 'string'
            ? value.match(/^\{\{context\.([a-zA-Z0-9_]+)\}\}$/)
            : null;
        if (match?.[1]) keys.add(match[1]);
    });
    return Array.from(keys);
}

function humanizeContextKey(key = '') {
    return String(key || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeFieldType(type, key) {
    if (Array.isArray(type)) {
        const selected = type.find((entry) => typeof entry === 'string' && entry !== 'null');
        if (selected) return selected;
    }
    if (typeof type === 'string' && type.trim()) return type.trim();
    if (/(_amount|_rent|_deposit|_total)$/.test(key) || key === 'amount') return 'number';
    if (key.endsWith('_id') || key.includes('_date') || key.endsWith('_mode')) return 'string';
    return 'string';
}

function inferFieldSource(fieldKey, fieldType, enumValues, preset) {
    if (preset?.source) return preset.source;
    if (enumValues.length > 0) return 'enum_select';
    if (fieldType === 'number') return 'number_input';
    if (fieldType === 'boolean') return 'boolean_toggle';
    if (fieldType === 'array' || fieldType === 'object') return 'json_editor';
    if (fieldKey.endsWith('_date') || fieldKey === 'date') return 'date_input';
    if (fieldKey.includes('note') || fieldKey.includes('remark') || fieldKey.includes('comment')) return 'textarea';
    return 'text_input';
}

function buildFieldSchema(contextKeys = [], requiredKeySet = new Set(), anyOfGroups = [], toolSchema = {}) {
    const properties = toolSchema?.properties || {};
    const required = toolSchema?.required || [];
    const toolRequiredSet = new Set(Array.isArray(required) ? required : []);

    return contextKeys.map((fieldKey) => {
        const preset = CONTEXT_FIELD_PRESETS[fieldKey] || {};
        const propertySchema = properties[fieldKey] || {};
        const fieldType = normalizeFieldType(propertySchema?.type, fieldKey);
        const enumValues = Array.isArray(propertySchema?.enum)
            ? propertySchema.enum
            : (Array.isArray(preset.enum)
                ? preset.enum
                : (Array.isArray(DEFAULT_ENUMS_BY_KEY[fieldKey]) ? DEFAULT_ENUMS_BY_KEY[fieldKey] : []));
        const anyOfGroupIndexes = anyOfGroups
            .map((group, index) => (Array.isArray(group) && group.includes(fieldKey) ? index : -1))
            .filter((index) => index >= 0);

        return {
            key: fieldKey,
            label: preset.label || humanizeContextKey(fieldKey),
            hint: preset.hint || null,
            type: fieldType,
            source: inferFieldSource(fieldKey, fieldType, enumValues, preset),
            required: requiredKeySet.has(fieldKey) || toolRequiredSet.has(fieldKey),
            enum: enumValues,
            depends_on: preset.depends_on || null,
            default_value: Object.prototype.hasOwnProperty.call(preset, 'default_value') ? preset.default_value : null,
            any_of_group_indexes: anyOfGroupIndexes,
        };
    });
}

function resolveFinanceButtonContracts(workflows = [], tenantId = null, toolSchemas = {}) {
    const rows = Array.isArray(workflows) ? workflows : [];
    const schemaIndex = (toolSchemas && typeof toolSchemas === 'object') ? toolSchemas : {};
    return FINANCE_BUTTON_ACTIONS.map((action) => {
        const canonicalWorkflowId = FINANCIAL_MUTATION_TOOL_TO_WORKFLOW[action.tool_name] || null;
        const canonical = canonicalWorkflowId
            ? rows.find((workflow) => workflow.workflow_id === canonicalWorkflowId)
            : null;
        const effective = canonical
            ? (resolveEffectiveWorkflow(rows, canonical.workflow_family, tenantId) || canonical)
            : null;
        const selected = effective || canonical || null;
        const selectedStep = Array.isArray(selected?.steps)
            ? selected.steps.find((step) => step?.tool === action.tool_name) || selected.steps[0] || null
            : null;
        const contextKeys = extractContextKeys(selectedStep?.params || {});
        const anyOfGroups = (Array.isArray(action.any_of_context_keys) ? action.any_of_context_keys : [])
            .map((group) => Array.isArray(group) ? group.filter((key) => contextKeys.includes(key)) : [])
            .filter((group) => group.length > 0);
        const toolSchema = schemaIndex[action.tool_name] || {};
        const toolRequired = Array.isArray(toolSchema?.required) ? toolSchema.required : [];
        const requiredKeySet = new Set([
            ...(Array.isArray(action.required_context_keys) ? action.required_context_keys : []),
            ...toolRequired,
        ].filter((key) => contextKeys.includes(key)));
        const requiredKeys = Array.from(requiredKeySet);
        const fieldSchema = buildFieldSchema(contextKeys, requiredKeySet, anyOfGroups, toolSchema);

        return {
            action_id: action.action_id,
            button_label: action.button_label,
            tool_name: action.tool_name,
            workflow_id: selected?.workflow_id || canonicalWorkflowId || null,
            workflow_family: selected?.workflow_family || null,
            workflow_name: selected?.name || null,
            deterministic: Boolean(selected?.deterministic),
            protected: Boolean(selected?.protected),
            context_keys: contextKeys,
            required_context_keys: requiredKeys,
            any_of_context_keys: anyOfGroups,
            field_schema: fieldSchema,
            smart_behavior: action.smart_behavior,
        };
    });
}

module.exports = {
    FINANCE_BUTTON_ACTIONS,
    resolveFinanceButtonContracts,
};
