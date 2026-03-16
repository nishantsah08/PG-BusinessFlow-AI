const {
    buildDefaultSopDocument,
    deriveWorkflowFamily,
    normalizeWorkflowDefinition,
} = require('./workflowGovernance');

function slugify(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function toTitleCase(value = '') {
    return String(value || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function inferBusinessDomain(text = '', workflow = {}) {
    const lower = String(text || '').toLowerCase();
    if (workflow.domain) return workflow.domain;
    if (String(workflow.workflow_family || '').startsWith('finance_')) return 'finance';
    if (lower.includes('finance') || lower.includes('payment') || lower.includes('bill') || lower.includes('rent') || lower.includes('salary')) {
        return 'finance';
    }
    if (lower.includes('candidate') || lower.includes('staff') || lower.includes('hiring') || lower.includes('hr')) {
        return 'hr';
    }
    if (lower.includes('lead') || lower.includes('crm') || lower.includes('sales')) {
        return 'crm';
    }
    if (lower.includes('property') || lower.includes('room') || lower.includes('maintenance')) {
        return 'property';
    }
    return 'operations';
}

function getSectionMap(workflow = {}) {
    const sop = workflow.sop_document || buildDefaultSopDocument(workflow);
    const map = new Map();
    (Array.isArray(sop.sections) ? sop.sections : []).forEach((section) => {
        map.set(section.key, {
            key: section.key,
            title: section.title,
            content: String(section.content || ''),
        });
    });
    return {
        title: sop.title || workflow.name || 'Untitled SOP',
        sections: map,
        advanced: sop.advanced || {},
    };
}

function rebuildSopDocument(workflow = {}, updates = {}) {
    const current = getSectionMap(workflow);
    const mergedSections = [
        { key: 'business_outcome', title: 'Business outcome' },
        { key: 'when_this_runs', title: 'When this runs' },
        { key: 'who_can_initiate_and_approve', title: 'Who can initiate and approve' },
        { key: 'detailed_flow', title: 'Detailed flow' },
        { key: 'preconditions', title: 'Preconditions' },
        { key: 'failure_and_rollback_policy', title: 'Failure and rollback policy' },
        { key: 'scope_and_ownership', title: 'Scope and ownership' },
    ].map((shape) => {
        const next = updates[shape.key] ?? current.sections.get(shape.key)?.content ?? '';
        return {
            key: shape.key,
            title: shape.title,
            content: String(next || ''),
        };
    });

    return {
        title: String(updates.title || current.title || workflow.name || 'Untitled SOP').trim(),
        sections: mergedSections,
        advanced: {
            ...current.advanced,
            ...workflow.sop_document?.advanced,
        },
    };
}

function createStructuredStepsFromLines(lines = [], domain = 'operations') {
    const agentByDomain = {
        finance: 'FinanceAI',
        hr: 'HRAgent',
        crm: 'CRMAgent',
        property: 'PropertyAI',
        operations: 'MasterAI',
    };
    const toolByDomain = {
        finance: 'get_financial_summary',
        hr: 'get_all_staff',
        crm: 'get_recent_leads',
        property: 'get_properties',
        operations: 'delegate_to_agent',
    };
    const agent = agentByDomain[domain] || 'MasterAI';
    const tool = toolByDomain[domain] || 'delegate_to_agent';

    return lines.map((line, index) => ({
        step_id: `${slugify(line) || `step_${index + 1}`}_${index + 1}`,
        description: line,
        agent,
        tool,
        params: { instruction: line },
        on_failure: 'abort',
    }));
}

function summarizeSystemContext(systemContext = {}) {
    const parts = [];
    const propertyCount = Number(systemContext?.property?.property_count || 0);
    const unitCount = Number(systemContext?.property?.unit_count || 0);
    const staffCount = Number(systemContext?.hr?.staff_count || 0);
    const vendorCount = Number(systemContext?.finance?.vendor_count || 0);
    const activeSops = Number(systemContext?.visible_sops?.counts?.active || 0);

    if (propertyCount > 0) parts.push(`${propertyCount} properties`);
    if (unitCount > 0) parts.push(`${unitCount} units`);
    if (staffCount > 0) parts.push(`${staffCount} staff members`);
    if (vendorCount > 0) parts.push(`${vendorCount} vendors`);
    if (activeSops > 0) parts.push(`${activeSops} live SOPs`);

    return parts.join(', ');
}

function buildContextAwareScope(domain = 'operations', systemContext = {}) {
    const propertyCount = Number(systemContext?.property?.property_count || 0);
    const unitCount = Number(systemContext?.property?.unit_count || 0);
    const staffCount = Number(systemContext?.hr?.staff_count || 0);
    const vendorCount = Number(systemContext?.finance?.vendor_count || 0);

    if (domain === 'finance') {
        const scopeParts = [];
        if (propertyCount > 0) scopeParts.push(`${propertyCount} properties`);
        if (unitCount > 0) scopeParts.push(`${unitCount} units`);
        if (vendorCount > 0) scopeParts.push(`${vendorCount} vendors`);
        return [
            `- Scope: ${scopeParts.length > 0 ? `finance operations currently spanning ${scopeParts.join(', ')}.` : 'finance procedures controlled through this SOP.'}`,
            '- Owner: Finance',
        ].join('\n');
    }

    if (domain === 'property') {
        return [
            `- Scope: ${propertyCount > 0 || unitCount > 0 ? `property operations across ${propertyCount || 0} properties and ${unitCount || 0} units.` : 'property procedures controlled through this SOP.'}`,
            '- Owner: Property',
        ].join('\n');
    }

    if (domain === 'hr') {
        return [
            `- Scope: ${staffCount > 0 ? `people operations for ${staffCount} staff records.` : 'people operations controlled through this SOP.'}`,
            '- Owner: HR',
        ].join('\n');
    }

    if (domain === 'crm') {
        return [
            '- Scope: CRM and lead-handling procedures controlled through this SOP.',
            '- Owner: CRM',
        ].join('\n');
    }

    return [
        '- Scope: cross-system business procedures controlled through this SOP.',
        '- Owner: Operations',
    ].join('\n');
}

function buildBlueprintFromRequest(message = '', workflow = {}, options = {}) {
    const normalized = String(message || '').trim();
    const lower = normalized.toLowerCase();
    const domain = inferBusinessDomain(normalized, workflow);
    const systemContext = options.system_context || {};
    const contextSummary = summarizeSystemContext(systemContext);
    const rawTitle = normalized
        .replace(/^create\s+(a\s+)?/i, '')
        .replace(/^new\s+/i, '')
        .replace(/^workflow\s+/i, '')
        .replace(/^sop\s+/i, '')
        .trim();
    const title = toTitleCase(rawTitle || 'New Business SOP');
    const family = workflow.workflow_family && workflow.workflow_family !== 'new_workflow_draft'
        ? workflow.workflow_family
        : `${domain}_${slugify(title) || 'procedure'}`;

    let businessOutcome = `Define how the business should handle "${title}" with clear checks, responsibilities, and a stable outcome.`;
    let whenThisRuns = '- Manual run: when the business asks for this SOP to be used.';
    let whoCan = '- Can start: CEO\n- Approval needed: CEO';
    let detailedFlow = [
        '1. Confirm the request context.',
        '   Identify who raised the request, what business object is affected, and what facts must be present before the SOP can begin.',
        '2. Review the business preconditions.',
        '   Check that the request is valid, complete, and safe to process before the main action starts.',
        '3. Perform the governed business action.',
        '   Carry out the main business step using the approved operating rule for this SOP.',
        '4. Record the result and hand it off.',
        '   Preserve the final outcome, the owner, and the next action so the business can continue without confusion.',
    ];
    let preconditions = '- Core business facts are known before this SOP starts.';
    let rollback = '- If the request is incomplete or ambiguous, stop before changing business records.';
    let scope = buildContextAwareScope(domain, systemContext);

    if (contextSummary) {
        businessOutcome = `${businessOutcome} Current business context available to the assistant includes ${contextSummary}.`;
    }

    if (family === 'finance_generate_monthly_bills' || lower.includes('monthly bill')) {
        businessOutcome = "For the target month, create each tenant's bill using approved contract terms, record the final billing entries in Finance, and prepare the bill output that can be sent to the customer.";
        whenThisRuns = '- Scheduled run: last day of every month at 10:00 PM IST.\n- Manual run: when the CEO asks for monthly billing.';
        whoCan = '- Can start: CEO, System\n- Approval needed: CEO';
        detailedFlow = [
            '1. Confirm who needs to be billed.',
            '   Identify the target month and the tenants included in this cycle. Make sure the billing scope is clear before calculations begin.',
            '2. Load the contract details.',
            '   Read the active contract details for each tenant and bring in rent terms, utility timing, deposits, and any dues context that changes the bill.',
            '3. Calculate each bill.',
            '   Calculate rent, charges, discounts, and approved adjustments. Apply prorated billing where the contract started or changed during the month.',
            '4. Record the final billing entries.',
            '   Save the billing result in Finance as the official monthly bill and create stable bill references so the result can be traced later.',
            '5. Prepare the bill for sending.',
            '   Produce the final bill output needed for customer communication, including the references required for PDF or link delivery.',
            '6. Hand the result to the next systems.',
            '   Pass the bill output to communication or CRM systems if needed. If communication fails, keep the Finance bill intact and follow up separately.',
        ];
        preconditions = '- An active tenant contract exists.\n- The billing month is clearly known.\n- The tenant list for billing is clear.';
        rollback = '- If contract details or billing month are missing, stop before billing entries are written.\n- If communication fails after Finance is updated, do not remove the bill. Treat communication failure as follow-up work.';
        scope = buildContextAwareScope('finance', systemContext);
    }

    const stepTitles = detailedFlow
        .filter((line) => /^\d+\./.test(line))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim());

    return {
        name: title,
        workflow_family: family,
        domain,
        module_owner: toTitleCase(domain),
        description: businessOutcome,
        trigger_type: family.startsWith('finance_') ? 'intent' : 'intent',
        trigger_description: whenThisRuns.replace(/^- /gm, '').split('\n')[0] || '',
        deterministic: domain === 'finance',
        approval: {
            required: true,
            initiators: domain === 'finance' ? ['CEO', 'Staff'] : ['CEO'],
            approvers: ['CEO'],
            surfaces: ['SOP Workspace'],
            response_format: 'yes_no_optional_note',
        },
        confidence: {
            level: domain === 'finance' ? 'very_high' : 'high',
            rule: preconditions.replace(/^- /gm, ''),
        },
        rollback_policy: {
            mode: 'abort',
            rule: rollback.replace(/^- /gm, ''),
        },
        user_view_title: title,
        user_view_steps: stepTitles,
        steps: createStructuredStepsFromLines(stepTitles, domain),
        sop_document: rebuildSopDocument(workflow, {
            title,
            business_outcome: businessOutcome,
            when_this_runs: whenThisRuns,
            who_can_initiate_and_approve: whoCan,
            detailed_flow: detailedFlow.join('\n'),
            preconditions: preconditions,
            failure_and_rollback_policy: rollback,
            scope_and_ownership: scope,
        }),
    };
}

function addReceiptCheckPatch(workflow = {}) {
    const current = getSectionMap(workflow);
    const detailedFlow = String(current.sections.get('detailed_flow')?.content || '');
    if (/receipt|payment proof|collection proof|transfer reference/i.test(detailedFlow)) {
        return {
            assistant_message: 'Receipt-proof guidance is already present in this SOP.',
            proposal: null,
        };
    }

    const insertBlock = [
        '3. Review the payment proof.',
        '   Make sure the receipt, transfer reference, or collection proof is available and clear enough for later audit.',
    ].join('\n');

    const nextDetailedFlow = detailedFlow.includes('4.')
        ? detailedFlow.replace(/\n4\./, `\n${insertBlock}\n4.`)
        : `${detailedFlow}\n${insertBlock}`.trim();

    const nextUserViewSteps = Array.isArray(workflow.user_view_steps) && workflow.user_view_steps.length > 0
        ? [...workflow.user_view_steps]
        : [];
    if (!nextUserViewSteps.some((step) => /payment proof|receipt/i.test(step))) {
        nextUserViewSteps.splice(Math.min(2, nextUserViewSteps.length), 0, 'Review the payment proof.');
    }

    const stepTitles = nextUserViewSteps.length > 0
        ? nextUserViewSteps
        : [
            'Confirm the booking-hold context.',
            'Check whether onboarding is still incomplete.',
            'Review the payment proof.',
            'Record the booking hold in Finance.',
        ];

    return {
        assistant_message: 'I prepared a safer draft by adding a payment-proof review before finance posting.',
        proposal: {
            preview: 'Add a payment-proof review before Finance records are updated.',
            patch: {
                description: workflow.description && !/proof/i.test(workflow.description)
                    ? `${workflow.description} Payment proof is reviewed before Finance is updated.`
                    : workflow.description,
                user_view_steps: stepTitles,
                steps: createStructuredStepsFromLines(stepTitles, inferBusinessDomain('', workflow)),
                sop_document: rebuildSopDocument(workflow, {
                    detailed_flow: nextDetailedFlow,
                }),
            },
        },
    };
}

function clarifyPatch(workflow = {}) {
    const current = getSectionMap(workflow);
    const detailedFlow = String(current.sections.get('detailed_flow')?.content || '');
    const nextDetailedFlow = /hand it off|next systems|inform the next owner/i.test(detailedFlow)
        ? `${detailedFlow}\nThe final handoff must name the owner, the decision taken, and any follow-up deadline.`
        : `${detailedFlow}\n4. Hand the result to the next owner.\n   Return the final outcome to the responsible owner, including the next action and any follow-up deadline.`.trim();

    return {
        assistant_message: 'I prepared a clarification update to make the SOP easier to review and operate.',
        proposal: {
            preview: 'Clarify the business outcome and strengthen the final operating handoff.',
            patch: {
                description: workflow.description && !/next action|follow-up/i.test(workflow.description)
                    ? `${workflow.description} The outcome is handed back with a clear owner, next action, and follow-up timing.`
                    : workflow.description,
                sop_document: rebuildSopDocument(workflow, {
                    detailed_flow: nextDetailedFlow,
                }),
            },
        },
    };
}

function removeRollbackPatch(workflow = {}) {
    return {
        assistant_message: 'I can remove the rollback rule, but validation will fail for a finance SOP without it.',
        proposal: {
            preview: 'Remove the failure and rollback rule from this SOP.',
            patch: {
                rollback_policy: {
                    mode: 'abort',
                    rule: '',
                },
                sop_document: rebuildSopDocument(workflow, {
                    failure_and_rollback_policy: '',
                }),
            },
        },
    };
}

function removeApprovalPatch(workflow = {}) {
    return {
        assistant_message: 'I can remove the approval rule, but validation will fail once approval is missing.',
        proposal: {
            preview: 'Remove approval from this SOP.',
            patch: {
                approval: {
                    ...(workflow.approval || {}),
                    required: false,
                    approvers: [],
                },
                sop_document: rebuildSopDocument(workflow, {
                    who_can_initiate_and_approve: '- Can start: CEO\n- Approval needed: Not defined',
                }),
            },
        },
    };
}

function greetingReply(workflow = {}) {
    const status = workflow.version_type === 'tenant_draft'
        ? 'draft'
        : workflow.version_type === 'archived_snapshot'
            ? 'archived'
            : 'active';
    return {
        assistant_message: `This SOP is ${status}. Ask for a change and I will prepare a proposal for this SOP only.`,
        proposal: null,
    };
}

function proposeSopAssistantReply(workflow = {}, message = '', options = {}) {
    const normalized = String(message || '').trim();
    const lower = normalized.toLowerCase();
    if (!normalized || /^(hi|hello|hey)$/i.test(normalized)) {
        return greetingReply(workflow);
    }

    const blankDraft = workflow.version_type === 'tenant_draft'
        && Array.isArray(workflow.steps)
        && workflow.steps.length === 0
        && (!workflow.description || !workflow.description.trim());

    if (blankDraft || /\b(create|new)\b/.test(lower)) {
        const blueprint = buildBlueprintFromRequest(normalized, workflow, options);
        return {
            assistant_message: 'I prepared the first SOP draft based on your request.',
            proposal: {
                preview: `Create the first SOP draft for "${blueprint.name}".`,
                patch: blueprint,
            },
        };
    }

    if (lower.includes('remove rollback') || lower.includes('without rollback') || lower.includes('no rollback')) {
        return removeRollbackPatch(workflow);
    }

    if (lower.includes('remove approval') || lower.includes('without approval') || lower.includes('no approval')) {
        return removeApprovalPatch(workflow);
    }

    if (lower.includes('receipt') || lower.includes('proof') || lower.includes('safety') || lower.includes('check')) {
        return addReceiptCheckPatch(workflow);
    }

    if (lower.includes('explain')) {
        const contextSummary = summarizeSystemContext(options.system_context || {});
        return {
            assistant_message: contextSummary
                ? `${workflow.description || 'This SOP still needs a business outcome.'}\n\nCurrent business context loaded for this SOP: ${contextSummary}.`
                : (workflow.description || 'This SOP still needs a business outcome.'),
            proposal: null,
        };
    }

    return clarifyPatch(workflow);
}

function applySopPatch(workflow = {}, patch = {}, options = {}) {
    return normalizeWorkflowDefinition({
        ...workflow,
        ...patch,
        tenant_id: workflow.tenant_id,
        version_type: workflow.version_type || 'tenant_draft',
        validation_status: 'draft',
    }, {
        existingWorkflow: workflow,
        existingWorkflows: options.existingWorkflows || [],
        allowIncomplete: true,
    });
}

module.exports = {
    applySopPatch,
    proposeSopAssistantReply,
};
