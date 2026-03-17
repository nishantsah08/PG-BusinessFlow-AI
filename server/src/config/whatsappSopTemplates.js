const WORKFLOW_WHATSAPP_TEMPLATE_MAP = {
    finance_record_booking_hold_v1: [
        {
            audience: 'customer',
            purpose: 'booking_hold_confirmation',
            template_name: 'booking_hold_confirmation_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['customer_name', 'booking_amount', 'property_or_unit', 'received_date', 'hold_valid_till', 'caretaker_phone'],
        },
    ],
    finance_complete_onboarding_from_booking_v1: [
        {
            audience: 'customer',
            purpose: 'onboarding_confirmation',
            template_name: 'onboarding_confirmation_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'property_name', 'onboarding_date', 'unit_name', 'monthly_rent', 'security_deposit', 'caretaker_phone'],
        },
        {
            audience: 'customer',
            purpose: 'police_verification_request',
            template_name: 'police_verification_request_en',
            window_policy: 'template_allowed_anytime',
            variable_keys: [],
            notes: 'Static approved police verification message.',
        },
    ],
    finance_onboard_tenant_v1: [
        {
            audience: 'customer',
            purpose: 'onboarding_confirmation',
            template_name: 'onboarding_confirmation_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'property_name', 'onboarding_date', 'unit_name', 'monthly_rent', 'security_deposit', 'caretaker_phone'],
        },
        {
            audience: 'customer',
            purpose: 'police_verification_request',
            template_name: 'police_verification_request_en',
            window_policy: 'template_allowed_anytime',
            variable_keys: [],
            notes: 'Static approved police verification message.',
        },
    ],
    finance_generate_monthly_bills_v1: [
        {
            audience: 'customer',
            purpose: 'monthly_bill_delivery',
            template_name: 'rent_due_cycle_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'billing_month', 'property_or_unit', 'amount_due', 'due_date', 'bill_link'],
        },
    ],
    finance_rent_collection_v1: [
        {
            audience: 'customer',
            purpose: 'rent_due_and_reminder',
            template_name: 'rent_due_cycle_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'billing_month', 'property_or_unit', 'amount_due', 'due_date', 'bill_link'],
        },
        {
            audience: 'customer',
            purpose: 'payment_acknowledgement',
            template_name: 'payment_received_confirmation_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'amount', 'billing_month_or_reason', 'payment_reference', 'posted_status'],
        },
        {
            audience: 'ceo',
            purpose: 'likely_unpaid_summary',
            template_name: 'likely_unpaid_summary_ceo_en',
            window_policy: 'template_allowed_anytime',
            variable_keys: ['billing_month', 'business_date', 'summary_block'],
        },
    ],
    finance_record_incoming_txn_v1: [
        {
            audience: 'customer',
            purpose: 'payment_acknowledgement',
            template_name: 'payment_received_confirmation_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'amount', 'billing_month_or_reason', 'payment_reference', 'posted_status'],
        },
    ],
    finance_offboard_tenant_v1: [
        {
            audience: 'customer',
            purpose: 'offboarding_settlement',
            template_name: 'offboarding_settlement_en',
            window_policy: 'prefer_free_text_then_template',
            variable_keys: ['tenant_name', 'property_or_unit', 'move_out_date', 'settlement_status_line', 'settlement_amount', 'payment_mode'],
        },
    ],
};

function cloneEntries(entries = []) {
    return entries.map((entry) => ({
        ...entry,
        variable_keys: Array.isArray(entry.variable_keys) ? [...entry.variable_keys] : [],
    }));
}

function getWhatsAppTemplatesForWorkflowId(workflowId) {
    return cloneEntries(WORKFLOW_WHATSAPP_TEMPLATE_MAP[String(workflowId || '').trim()] || []);
}

function attachWhatsAppTemplates(workflow = {}) {
    return {
        ...workflow,
        whatsapp_templates: getWhatsAppTemplatesForWorkflowId(workflow.workflow_id),
    };
}

module.exports = {
    WORKFLOW_WHATSAPP_TEMPLATE_MAP,
    getWhatsAppTemplatesForWorkflowId,
    attachWhatsAppTemplates,
};
