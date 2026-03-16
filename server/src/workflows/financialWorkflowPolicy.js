const TimeAuthorityService = require('../services/TimeAuthorityService');
const { normalizeWorkflowDefinition } = require('./workflowGovernance');

const FINANCIAL_MUTATION_TOOL_TO_WORKFLOW = {
    onboard_tenant_contract: 'finance_onboard_tenant_contract_v1',
    generate_monthly_bills: 'finance_generate_monthly_bills_v1',
    add_ledger_entry: 'finance_add_ledger_entry_v1',
    add_vendor: 'finance_add_vendor_v1',
    record_booking_hold: 'finance_record_booking_hold_v1',
    expire_booking_hold: 'finance_expire_booking_hold_v1',
    complete_onboarding_from_booking: 'finance_complete_onboarding_from_booking_v1',
    offboard_tenant: 'finance_offboard_tenant_v1',
    record_incoming_txn: 'finance_record_incoming_txn_v1',
    record_outgoing_txn: 'finance_record_outgoing_txn_v1',
    process_salary_payout: 'finance_process_salary_payout_v1',
    record_correction_txn: 'finance_record_correction_txn_v1',
};

const PREDEFINED_FINANCIAL_WORKFLOWS = [
    {
        workflow_id: 'finance_add_vendor_v1',
        workflow_family: 'finance_add_vendor',
        name: 'Finance Vendor Registration',
        description: 'Deterministic workflow for creating or reusing a vendor in the finance register before expense posting.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when CEO or Staff needs to register a vendor in the finance register for controlled outgoing tracking.',
        user_view_title: 'Register Vendor (Plain English)',
        user_view_steps: [
            'Capture the vendor profile needed for expense tracking.',
            'Reuse an existing vendor when the same payee is already registered.',
            'Return the vendor record for later outgoing workflows.'
        ],
        trigger_event: 'finance.vendor.add.requested',
        trigger_description: 'When the business needs a tracked vendor record for finance operations.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'high',
            rule: 'Vendor registration requires a clear vendor name and enough identity fields to avoid accidental duplicates.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if vendor identity is too ambiguous. Do not create duplicate vendor records when an existing one clearly matches.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: true,
        steps: [
            {
                step_id: 'finance_add_vendor',
                description: 'Create or reuse a vendor in FinanceAI.',
                agent: 'FinanceAI',
                tool: 'add_vendor',
                params: {
                    vendor_name: '{{context.vendor_name}}',
                    category: '{{context.category}}',
                    primary_phone: '{{context.primary_phone}}',
                    email: '{{context.email}}',
                    upi_id: '{{context.upi_id}}',
                    bank_details: '{{context.bank_details}}',
                    notes: '{{context.notes}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_record_booking_hold_v1',
        workflow_family: 'finance_record_booking_hold',
        name: 'Record Booking Hold',
        description: 'Deterministic workflow for recording a pre-onboarding booking hold payment.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when the business receives booking money before final onboarding or unit allocation is complete.',
        user_view_title: 'Record Booking Hold (Plain English)',
        user_view_steps: [
            'Capture booking money against the payer account.',
            'Hold the amount without treating it as active rent collection yet.',
            'Start the 10-day validity window for onboarding completion.'
        ],
        trigger_event: 'finance.booking.hold.record.requested',
        trigger_description: 'When booking money is received before onboarding is completed.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Booking hold recording requires unambiguous payer, amount, and received date before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if booking hold context is incomplete. Do not convert booking money into live rent collection implicitly.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: false,
        steps: [
            {
                step_id: 'finance_record_booking_hold',
                description: 'Record booking-hold money in FinanceAI.',
                agent: 'FinanceAI',
                tool: 'record_booking_hold',
                params: {
                    payer_id: '{{context.payer_id}}',
                    amount: '{{context.amount}}',
                    received_at: '{{context.received_at}}',
                    linked_property_id: '{{context.linked_property_id}}',
                    linked_unit_id: '{{context.linked_unit_id}}',
                    evidence_link: '{{context.evidence_link}}',
                    notes: '{{context.notes}}',
                    payment_mode: '{{context.payment_mode}}',
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_expire_booking_hold_v1',
        workflow_family: 'finance_expire_booking_hold',
        name: 'Expire Booking Hold',
        description: 'Deterministic workflow for expiring booking holds that were not converted into onboarding within ten days.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'schedule',
        schedule: {
            timezone: 'Asia/Kolkata',
            frequency: 'daily',
            run_time: '21:00',
            scope: 'active booking holds',
        },
        user_view_title: 'Expire Booking Hold (Plain English)',
        user_view_steps: [
            'Check all active booking holds.',
            'Expire those whose ten-day onboarding window has ended.',
            'Mark them forfeited without refund.'
        ],
        trigger_event: 'finance.booking.hold.expiry.requested',
        trigger_description: 'When the booking hold validity window ends without onboarding.',
        approval: {
            required: true,
            initiators: ['CEO', 'System'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Booking hold expiry requires an active hold that has exceeded the ten-day validity window.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if the booking hold is already closed or cannot be resolved deterministically.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_expire_booking_hold',
                description: 'Expire the booking hold and mark it forfeited.',
                agent: 'FinanceAI',
                tool: 'expire_booking_hold',
                params: {
                    booking_hold_id: '{{context.booking_hold_id}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_complete_onboarding_from_booking_v1',
        workflow_family: 'finance_complete_onboarding_from_booking',
        name: 'Finance Complete Onboarding From Booking',
        description: 'Deterministic workflow for converting a booking hold into an onboarded tenant contract and applying the held money commercially from the onboarding date.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when CEO finalizes onboarding from an existing booking hold and may backdate the onboarding date.',
        user_view_title: 'Complete Onboarding From Booking (Plain English)',
        user_view_steps: [
            'Take the active booking hold and the CEO-entered onboarding date.',
            'Assign the final unit if required.',
            'Create the tenant contract and apply the held money from onboarding date.'
        ],
        trigger_event: 'finance.booking.hold.onboarding.requested',
        trigger_description: 'When CEO completes onboarding from booking hold.',
        approval: {
            required: true,
            initiators: ['CEO'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Onboarding completion requires a valid booking hold, onboarding date, rent terms, and final unit context before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if unit assignment or contract creation cannot be completed cleanly.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: true,
        steps: [
            {
                step_id: 'property_assign_tenant',
                description: 'Assign the final unit to the tenant when the onboarding workflow includes unit context.',
                agent: 'PropertyAI',
                tool: 'assign_tenant',
                params: {
                    unit_id: '{{context.unit_id}}',
                    lead_id: '{{context.lead_id}}',
                    start_date: '{{context.onboarding_date}}',
                    monthly_rent: '{{context.negotiated_rent}}',
                    security_deposit: '{{context.security_deposit}}'
                },
                on_failure: 'abort'
            },
            {
                step_id: 'finance_complete_onboarding_from_booking',
                description: 'Create the finance contract version and apply booking hold commercially.',
                agent: 'FinanceAI',
                tool: 'complete_onboarding_from_booking',
                params: {
                    booking_hold_id: '{{context.booking_hold_id}}',
                    lead_id: '{{context.lead_id}}',
                    unit_id: '{{context.unit_id}}',
                    property_id: '{{context.property_id}}',
                    onboarding_date: '{{context.onboarding_date}}',
                    negotiated_rent: '{{context.negotiated_rent}}',
                    security_deposit: '{{context.security_deposit}}',
                    rent_payment_timing: '{{context.rent_payment_timing}}',
                    utility_payment_timing: '{{context.utility_payment_timing}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_onboard_tenant_v1',
        workflow_family: 'finance_onboard_tenant',
        name: 'Onboard Tenant',
        description: 'Business-facing SOP for onboarding a tenant through either direct onboarding or onboarding from booking after rate card lock.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when onboarding must be completed after final rate card lock, with direct or booking path decided by CEO.',
        user_view_title: 'Onboard Tenant (Plain English)',
        user_view_steps: [
            'Lock the negotiated rate card in the system first.',
            'Decide onboarding path: direct onboarding or from booking.',
            'Collect or apply onboarding dues and activate the tenant setup.',
            'Send final onboarding WhatsApp and separate police-verification template message.'
        ],
        trigger_event: 'finance.onboard.tenant.requested',
        trigger_description: 'When the business finalizes onboarding for a tenant.',
        approval: {
            required: true,
            initiators: ['CEO'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Onboarding requires locked rate card, final onboarding date, and clear direct-vs-booking path context before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if onboarding path or commercial terms are incomplete. Do not partially activate tenant contracts.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_onboard_contract',
                description: 'Store negotiated contract terms in FinanceAI as the onboarding commercial base.',
                agent: 'FinanceAI',
                tool: 'onboard_tenant_contract',
                params: {
                    lead_id: '{{context.lead_id}}',
                    unit_id: '{{context.unit_id}}',
                    property_id: '{{context.property_id}}',
                    negotiated_rent: '{{context.negotiated_rent}}',
                    security_deposit: '{{context.security_deposit}}',
                    rent_payment_timing: '{{context.rent_payment_timing}}',
                    utility_payment_timing: '{{context.utility_payment_timing}}',
                    effective_from: '{{context.effective_from}}',
                    effective_to: '{{context.effective_to}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_onboard_tenant_contract_v1',
        workflow_family: 'finance_onboard_tenant_contract',
        name: 'Finance Contract Onboarding',
        description: 'Deterministic workflow for registering negotiated tenant contract terms.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when CEO or an approved workflow needs to lock negotiated tenant commercial terms into Finance.',
        user_view_title: 'Onboard Tenant Contract (Plain English)',
        user_view_steps: [
            'Take the approved tenant commercial terms.',
            'Store these terms as the finance contract for that tenant.',
            'Return success only after the contract is stored.'
        ],
        trigger_event: 'finance.contract.onboard.requested',
        trigger_description: 'When finance contract terms are approved and must be locked.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'The system must know the tenant, negotiated amounts, and effective date with no ambiguity before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if contract terms are incomplete. Do not partially write finance contract state.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: true,
        steps: [
            {
                step_id: 'finance_onboard_contract',
                description: 'Persist negotiated contract terms in FinanceAI.',
                agent: 'FinanceAI',
                tool: 'onboard_tenant_contract',
                params: {
                    lead_id: '{{context.lead_id}}',
                    unit_id: '{{context.unit_id}}',
                    property_id: '{{context.property_id}}',
                    negotiated_rent: '{{context.negotiated_rent}}',
                    security_deposit: '{{context.security_deposit}}',
                    rent_payment_timing: '{{context.rent_payment_timing}}',
                    utility_payment_timing: '{{context.utility_payment_timing}}',
                    effective_from: '{{context.effective_from}}',
                    effective_to: '{{context.effective_to}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_generate_monthly_bills_v1',
        workflow_family: 'finance_generate_monthly_bills',
        name: 'Generate Monthly Bills',
        description: 'Deterministic workflow for generating monthly rent/dues.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'schedule',
        schedule: {
            timezone: 'Asia/Kolkata',
            frequency: 'monthly',
            run_rule: 'last_day_of_month',
            run_time: '22:00',
            scope: 'all active tenant contracts',
            reruns: [
                { day_of_month: 5, purpose: 'late cycle tenants not sent in primary run' },
                { day_of_month: 10, purpose: 'late cycle tenants not sent in prior cycles' },
            ],
        },
        user_view_title: 'Generate Monthly Bills (Plain English)',
        user_view_steps: [
            'Read the tenant contract already stored in finance.',
            'Generate monthly bill entries for the target month.',
            'On 5th and 10th, rerun only for late-cycle tenants.',
            'Do not send duplicate bill output for the same tenant and month.'
        ],
        trigger_event: 'finance.billing.monthly.requested',
        trigger_description: 'When scheduled or manual monthly billing must be generated.',
        approval: {
            required: true,
            initiators: ['CEO', 'System'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Billing requires an active contract, target month, and unambiguous payer scope before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort before ledger writes when contract or billing month is missing. If communication fails after finance truth write, preserve finance truth and retry communication separately. Do not re-send bills already sent in prior cycle for the same tenant-month.',
        },
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
        workflow_family: 'finance_add_ledger_entry',
        name: 'Finance Manual Ledger Debit',
        description: 'Deterministic workflow for append-only debit entries.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run only when a CEO-approved manual debit needs to be added as a new append-only ledger entry.',
        user_view_title: 'Add Ledger Debit (Plain English)',
        user_view_steps: [
            'Receive approved debit details for a tenant/payer.',
            'Create exactly one new ledger debit entry.',
            'Never modify old entries; keep ledger append-only.'
        ],
        trigger_event: 'finance.ledger.debit.requested',
        trigger_description: 'When an approved manual debit must be added to ledger.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Ledger debit creation requires a resolved payer, category, amount, and month context before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if target payer or amount is ambiguous. Never edit prior ledger state to compensate.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: true,
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
        workflow_id: 'finance_rent_collection_v1',
        workflow_family: 'finance_rent_collection',
        name: 'Rent Collection',
        description: 'Business-facing SOP for rent due communication, approved incoming posting, remainder handling, and next-cycle carry rules.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'schedule',
        schedule: {
            timezone: 'Asia/Kolkata',
            frequency: 'monthly',
            run_rule: 'monthly_collection_cycle',
            milestones: ['4th reminder', '9th reminder', '15th stop_and_escalate'],
            scope: 'active billed tenants',
        },
        user_view_title: 'Rent Collection (Plain English)',
        user_view_steps: [
            'Send due communication and remainder templates on 4th and 9th.',
            'Post payment only after CEO approval, even if customer reports payment on WhatsApp or GUI.',
            'On 15th, stop remainder messages and send likely-unpaid summary to CEO.',
            'Carry pending and applicable fine into next month as per rate card and CEO decision.'
        ],
        trigger_event: 'finance.rent.collection.requested',
        trigger_description: 'When rent collection cycle is running for a billed tenant-month.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff', 'Customer', 'System'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Collection posting requires payer, amount, month context, and CEO approval before finance write.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort posting when payer, amount, or month is ambiguous. Do not post customer-reported payment without CEO approval.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_record_incoming',
                description: 'Record incoming payment after approval and apply waterfall.',
                agent: 'FinanceAI',
                tool: 'record_incoming_txn',
                params: {
                    payer_id: '{{context.payer_id}}',
                    amount: '{{context.amount}}',
                    payment_mode: '{{context.payment_mode}}',
                    date: '{{context.date}}',
                    attachment_url: '{{context.attachment_url}}',
                    txn_id: '{{context.txn_id}}',
                    linked_unit_id: '{{context.linked_unit_id}}',
                    linked_property_id: '{{context.linked_property_id}}',
                    context_type: '{{context.context_type}}',
                    note: '{{context.note}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_record_incoming_txn_v1',
        workflow_family: 'finance_record_incoming_txn',
        name: 'Record Incoming Payment',
        description: 'Deterministic workflow for posting incoming payment after CEO confirmation.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when a CEO or staff member requests payment posting and the system reaches very high confidence on payer, amount, and month context.',
        user_view_title: 'Post Incoming Payment (Plain English)',
        user_view_steps: [
            'Wait for CEO confirmation that payment is visible in bank statement.',
            'Record the incoming payment against payer ID.',
            'Apply waterfall allocation and return allocation summary.'
        ],
        trigger_event: 'finance.payment.incoming.confirmed',
        trigger_description: 'When CEO confirms payment is visible in bank statement.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Incoming payment posting requires payer, amount, mode, and approval context to be unambiguous. Back-and-forth is allowed until certainty is high.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort if the payment cannot be posted cleanly. Corrections must happen through a new compensating workflow, never by editing the original transaction.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: true,
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
                    txn_id: '{{context.txn_id}}',
                    linked_unit_id: '{{context.linked_unit_id}}',
                    linked_property_id: '{{context.linked_property_id}}',
                    context_type: '{{context.context_type}}',
                    note: '{{context.note}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_record_outgoing_txn_v1',
        workflow_family: 'finance_record_outgoing_txn',
        name: 'Record Outgoing Transaction',
        description: 'Deterministic workflow for recording outgoing business spending while FinanceAI resolves work context safely and handles caretaker reimbursement gating.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when a CEO or staff member needs to record a real-world outgoing payment and the system has enough context to place it safely.',
        user_view_title: 'Record Outgoing Transaction (Plain English)',
        user_view_steps: [
            'Capture outgoing request from CEO, staff, or caretaker.',
            'Ask follow-up questions if the work placement is unclear instead of guessing.',
            'For caretaker spending, keep reimbursement pending until CEO approval.',
            'Record the outgoing transaction and link it to the correct work context underneath.'
        ],
        trigger_event: 'finance.payment.outgoing.requested',
        trigger_description: 'When a business outgoing payment must be recorded safely with the correct work and vendor context.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Outgoing transaction posting requires explicit property, payee/vendor, payment details, and enough work context to avoid accidental misplacement.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort on ambiguity. Ask follow-up questions instead of guessing. Any later correction must be recorded through a new compensating workflow.',
        },
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
                    work_title: '{{context.work_title}}',
                    work_order_id: '{{context.work_order_id}}',
                    work_done: '{{context.work_done}}',
                    property_id: '{{context.property_id}}',
                    unit_id: '{{context.unit_id}}',
                    amount: '{{context.amount}}',
                    expense_total: '{{context.expense_total}}',
                    line_items: '{{context.line_items}}',
                    date: '{{context.date}}',
                    vendor_id: '{{context.vendor_id}}',
                    payee: '{{context.payee}}',
                    payment_mode: '{{context.payment_mode}}',
                    approved_by: '{{context.approved_by}}',
                    remarks: '{{context.remarks}}',
                    attachment_urls: '{{context.attachment_urls}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_offboard_tenant_v1',
        workflow_family: 'finance_offboard_tenant',
        name: 'Offboard Tenant',
        description: 'Business-facing SOP for final tenant settlement, money movement, closure comment, and mandatory customer closure message.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when tenant offboarding is initiated and final settlement must be calculated and closed under CEO control.',
        user_view_title: 'Offboard Tenant (Plain English)',
        user_view_steps: [
            'Calculate final settlement from rate card, notice period, and minimum-stay rules.',
            'Let CEO decide and execute final money movement (receive or send).',
            'Update accounts inside the same SOP, capture CEO comment, and close offboarding.',
            'Send mandatory final customer message with settlement details.'
        ],
        trigger_event: 'finance.offboard.tenant.requested',
        trigger_description: 'When tenant move-out is being settled and closed.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Offboarding requires tenant identity, move-out date, settlement direction, settlement amount, and CEO closure context.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Do not close offboarding before settlement movement is completed unless final balance is zero.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        steps: [
            {
                step_id: 'finance_offboard_tenant',
                description: 'Execute settlement movement and close offboarding with mandatory communication.',
                agent: 'FinanceAI',
                tool: 'offboard_tenant',
                params: {
                    payer_id: '{{context.payer_id}}',
                    move_out_date: '{{context.move_out_date}}',
                    settlement_direction: '{{context.settlement_direction}}',
                    settlement_amount: '{{context.settlement_amount}}',
                    settlement_payment_mode: '{{context.settlement_payment_mode}}',
                    ceo_comment: '{{context.ceo_comment}}',
                    customer_message: '{{context.customer_message}}',
                    notice_days_given: '{{context.notice_days_given}}',
                    min_stay_status: '{{context.min_stay_status}}'
                },
                on_failure: 'abort'
            }
        ]
    },
    {
        workflow_id: 'finance_process_salary_payout_v1',
        workflow_family: 'finance_process_salary_payout',
        name: 'Finance Salary Payout',
        description: 'Deterministic workflow for salary payout posting.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'schedule',
        schedule: {
            timezone: 'Asia/Kolkata',
            frequency: 'monthly',
            run_rule: 'configured_salary_date',
            run_time: '11:00',
            scope: 'approved payroll cycle',
        },
        user_view_title: 'Process Salary Payout (Plain English)',
        user_view_steps: [
            'Receive approved payroll staff and month context.',
            'Process salary payout through finance logic.',
            'Return paid amount and payout transaction ID.'
        ],
        trigger_event: 'finance.salary.payout.requested',
        trigger_description: 'When salary payout cycle is approved.',
        approval: {
            required: true,
            initiators: ['CEO', 'Staff', 'System'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'WhatsApp', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Salary payout requires an active salary card, bank details, payout month, and explicit approval before execution.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Abort before payout posting if salary inputs are incomplete. Do not mark salary as paid on partial failure.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: true,
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
    },
    {
        workflow_id: 'finance_record_correction_txn_v1',
        workflow_family: 'finance_record_correction_txn',
        name: 'Correct Finance Entry',
        description: 'Deterministic workflow for correcting prior finance outcomes without editing original records.',
        version: 'v1',
        module_owner: 'Finance',
        trigger_type: 'intent',
        intent_rule: 'Run when a prior finance transaction is wrong and a new compensating transaction must be added instead of editing the original record.',
        user_view_title: 'Correct Finance Entry (Plain English)',
        user_view_steps: [
            'Identify the original finance transaction that needs correction.',
            'Create a new compensating finance transaction with the correction reason.',
            'Link the correction to the original transaction and preserve full audit history.'
        ],
        trigger_event: 'finance.correction.requested',
        trigger_description: 'When a CEO-approved finance correction must be recorded as a new transaction.',
        approval: {
            required: true,
            initiators: ['CEO'],
            approvers: ['CEO'],
            surfaces: ['GUI chat', 'Finance Overview'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: 'very_high',
            rule: 'Correction requires an identified original transaction, correction direction, amount, and reason with no ambiguity.',
        },
        rollback_policy: {
            mode: 'abort',
            rule: 'Never edit the original transaction. Abort if the original record cannot be resolved or the correction payload is incomplete.',
        },
        deterministic: true,
        protected: true,
        domain: 'finance',
        ui_hidden: false,
        steps: [
            {
                step_id: 'finance_record_correction',
                description: 'Create a compensating transaction that corrects a prior finance record without editing the original.',
                agent: 'FinanceAI',
                tool: 'record_correction_txn',
                params: {
                    original_txn_id: '{{context.original_txn_id}}',
                    correction_type: '{{context.correction_type}}',
                    payer_id: '{{context.payer_id}}',
                    amount: '{{context.amount}}',
                    reason: '{{context.reason}}',
                    category: '{{context.category}}',
                    month_year: '{{context.month_year}}'
                },
                on_failure: 'abort'
            }
        ]
    }
];

const PREDEFINED_FINANCIAL_WORKFLOW_IDS = PREDEFINED_FINANCIAL_WORKFLOWS.map(w => w.workflow_id);
const LEGACY_WORKFLOW_IDS_TO_REMOVE = new Set([
    'payment_acknowledgement',
    'visit_followup',
    'property_enquiry',
    'operations_send_month_end_itemized_bill_v1',
    'operations_process_caretaker_salary_last_saturday_v1',
    'operations_confirm_customer_payment_and_post_v1',
    'operations_onboard_customer_after_payment_v1',
]);

function isProtectedPredefinedWorkflow(workflowId) {
    return PREDEFINED_FINANCIAL_WORKFLOW_IDS.includes(workflowId);
}

function ensurePredefinedFinancialWorkflows(workflowStore) {
    const existing = workflowStore.list().filter((workflow) => !LEGACY_WORKFLOW_IDS_TO_REMOVE.has(workflow.workflow_id));
    const byId = new Map(existing.map(w => [w.workflow_id, w]));
    let changed = false;

    for (const canonical of PREDEFINED_FINANCIAL_WORKFLOWS) {
        const current = byId.get(canonical.workflow_id);
        if (!current) {
            const normalized = normalizeWorkflowDefinition({
                ...canonical,
                sop_document: canonical.sop_document ?? null,
                version_type: 'system_template',
                created_at: TimeAuthorityService.nowIST(),
            }, { allowIncomplete: false });
            byId.set(canonical.workflow_id, normalized);
            changed = true;
            continue;
        }

        const normalized = normalizeWorkflowDefinition({
            ...current,
            ...canonical,
            sop_document: canonical.sop_document ?? null,
            version_type: 'system_template',
            created_at: current.created_at || canonical.created_at || TimeAuthorityService.nowIST(),
            updated_at: TimeAuthorityService.nowIST(),
        }, {
            existingWorkflow: current,
            existingWorkflows: existing,
            allowIncomplete: false,
        });
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
