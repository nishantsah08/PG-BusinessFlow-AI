const TimeAuthorityService = require('../services/TimeAuthorityService');

const WORKFLOW_TRIGGER_TYPES = new Set(['event', 'schedule', 'intent']);
const WORKFLOW_VERSION_TYPES = new Set([
    'system_template',
    'tenant_draft',
    'tenant_published',
    'archived_snapshot',
]);

const SOP_GOVERNANCE_SURFACES = ['SOP Workspace', 'Finance Overview'];

const SOP_DOCUMENT_PRESETS = {
    finance_generate_monthly_bills: {
        businessOutcome: "For the target month, create each tenant's bill using approved contract terms, record the final billing entries in Finance, and prepare the bill output that can be sent to the customer.",
        whenThisRuns: [
            '- Scheduled run: last day of every month at 10:00 PM IST.',
            '- Rerun cycle: 5th and 10th of every month for late-cycle tenants.',
            '- Manual run: when the CEO asks for monthly billing.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, System',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm who needs to be billed.',
            '   Identify the target month and the tenants included in this cycle. Make sure the billing scope is clear before calculations begin.',
            '2. Load the contract details.',
            '   Read the active contract details for each tenant and bring in rent terms, utility timing, deposits, and any dues context that changes the bill.',
            '3. Calculate each bill.',
            '   Calculate rent, charges, discounts, and approved adjustments. Apply prorated billing where the contract started or changed during the month.',
            '4. Record the final billing entries.',
            '   Save the billing result in Finance as the official monthly bill and create stable bill references so the result can be traced later.',
            '5. Run late-cycle bill windows on 5th and 10th.',
            '   Pick only eligible late-cycle tenants for the same billing month and avoid rebilling tenants already sent in prior cycles.',
            '6. Send bills through approved WhatsApp templates with variables.',
            '   Use template delivery fields such as tenant name, property, billing month, amount due, due date, and bill link.',
            '7. Keep finance truth safe if communication fails.',
            '   If communication fails after Finance is updated, do not remove bill entries. Handle communication retry separately.',
        ],
        preconditions: [
            '- An active tenant contract exists.',
            '- The billing month is clearly known.',
            '- The tenant list for billing is clear.',
        ],
        rollback: [
            '- If contract details or billing month are missing, stop before billing entries are written.',
            '- Do not send duplicate bills for the same tenant and billing month.',
            '- If communication fails after Finance is updated, do not remove the bill. Treat communication failure as follow-up work.',
        ],
    },
    finance_record_booking_hold: {
        businessOutcome: 'Use this SOP when booking money is received before onboarding is complete and the business needs to hold that money safely without treating it as normal rent collection.',
        whenThisRuns: [
            '- Manual run: when booking money is received before onboarding or final room allocation is complete.',
            '- This SOP should run only when payer, amount, received date, and supporting proof are clear.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm what money has been received.',
            '   Check who paid, how much was paid, when it was paid, and why it was collected. Make sure this is booking money and not normal rent.',
            '2. Confirm that onboarding is still incomplete.',
            '   Check that the resident has not fully onboarded yet. If onboarding is already complete, stop and move the case to the correct finance process.',
            '3. Review the payment proof.',
            '   Make sure the receipt, transfer reference, or collection proof is available and clear enough for later audit.',
            '4. Record the booking hold correctly in Finance.',
            '   Enter the amount as booking-hold money. Keep it separate from live rent collection so the business does not treat it as monthly revenue too early.',
            '5. Start the booking validity period.',
            '   Record the validity window linked to this hold so the business knows how long the hold remains valid and when follow-up is required.',
            '6. Send customer confirmation.',
            '   Thank the customer, confirm booking amount received and recorded, and tell them they can come directly for onboarding by calling the caretaker.',
        ],
        preconditions: [
            '- Payer name is known.',
            '- Amount and received date are known.',
            '- Payment proof is available.',
            '- The payment is being treated as booking money, not active rent.',
        ],
        rollback: [
            '- If payment proof or booking context is unclear, stop before any finance record is written.',
            '- Do not automatically convert booking money into live rent collection.',
        ],
    },
    finance_onboard_tenant: {
        businessOutcome: 'Complete tenant onboarding by first locking the negotiated rate card, then handling direct or booking path, collecting/applying onboarding dues, and activating the tenant for live operations.',
        whenThisRuns: [
            '- Manual run: when tenant onboarding is being finalized by the business.',
            '- This SOP starts with negotiated rate-card lock before money application.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Negotiate and lock the final rate card.',
            '   Finalize rent, deposit, payment timing, and onboarding-effective commercial terms.',
            '2. Confirm onboarding path.',
            '   Decide direct onboarding or onboarding from booking hold.',
            '3. Confirm room, onboarding date, and move-in details.',
            '   Finalize unit assignment and onboarding date before payment application.',
            '4. Calculate onboarding dues from locked rate card.',
            '   Compute what is payable or adjustable at onboarding, including prorata where applicable.',
            '5. Apply correct money path.',
            '   For booking path, apply held amount first. For direct path, collect onboarding dues as per negotiated card.',
            '6. Activate tenant commercially.',
            '   Finalize contract setup so live monthly operations can start.',
            '7. Send final onboarding communication.',
            '   Send WhatsApp onboarding confirmation with house rules and send police verification using separate approved template.',
        ],
        preconditions: [
            '- Tenant is identified and move-in decision is active.',
            '- Final rate card is agreed and lockable.',
            '- Onboarding path and date are clear.',
        ],
        rollback: [
            '- If rate card or path is unclear, stop before activation.',
            '- Do not partially activate onboarding state.',
        ],
    },
    finance_rent_collection: {
        businessOutcome: 'Run monthly rent collection cycle with reminder windows, CEO-approved posting, and controlled carry to next month when dues remain.',
        whenThisRuns: [
            '- Collection cycle runs after bill generation for target month.',
            '- Reminder windows: 4th and 9th.',
            '- On 15th, stop remainders and send likely-unpaid summary to CEO.',
        ],
        whoCanInitiateAndApprove: [
            '- Payment report can come from: Customer, Staff, CEO',
            '- Posting approval needed: CEO',
        ],
        detailedFlow: [
            '1. Read due position for tenant-month.',
            '   Confirm billed amount, pending dues, and current cycle status.',
            '2. Send due and remainder communication by template.',
            '   Use approved templates with variables on due cycle and on 4th and 9th.',
            '3. Wait for payment report through GUI or WhatsApp.',
            '   The system does not auto-assume payment; it waits for reported payment signal.',
            '4. Post payment only after CEO approval.',
            '   Even if customer reports payment, finance posting must wait for CEO approval.',
            '5. Recompute due after waterfall allocation.',
            '   Update settled, partial, or carry-forward status for the cycle.',
            '6. On 15th, close reminder cycle and escalate.',
            '   Stop remainders and send likely-unpaid tenant summary to CEO.',
            '7. Carry pending and late fine to next month.',
            '   Add applicable late fine in next month cycle per rate card and carry unresolved pending as approved.',
        ],
        preconditions: [
            '- Bill exists for the target month.',
            '- Payer and month context are clear.',
            '- CEO approval path is available.',
        ],
        rollback: [
            '- Do not post payment without CEO approval.',
            '- If payer or month is ambiguous, stop before posting.',
        ],
    },
    finance_record_incoming_txn: {
        businessOutcome: 'Record a confirmed incoming payment, classify it correctly, and apply guarded allocation without changing the original transaction truth later.',
        whenThisRuns: [
            '- Manual run: when finance has confirmed the payer, amount, date, and payment mode.',
            '- This SOP should run only when the system has enough confidence to post the money safely.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Resolve the payer and payment context.',
            '   Match the payer to the right resident, booking, or account and confirm the amount, received date, payment mode, and collection source.',
            '2. Decide what type of money has arrived.',
            '   Classify whether the payment is rent, booking money, deposit, fee recovery, or another approved finance category before any posting happens.',
            '3. Check allocation confidence.',
            '   Confirm the system has enough evidence to allocate the money safely. If the source or intent is unclear, stop and request clarification.',
            '4. Record the incoming transaction in Finance.',
            '   Create the immutable incoming-payment record with the original facts so later corrections never overwrite the source transaction.',
            '5. Apply guarded allocation.',
            '   Allocate the payment only to the approved target bucket, using the finance rules that protect deposits, booking holds, and rent from being mixed incorrectly.',
            '6. Return the posting result.',
            '   Provide finance and operations with the final outcome, including how the money was classified, where it was allocated, and whether any follow-up is still pending.',
        ],
        preconditions: [
            '- The payer is identified clearly.',
            '- Amount, date, and payment mode are known.',
            '- Approval context is complete.',
            '- Allocation target is clear enough to avoid accidental misposting.',
        ],
        rollback: [
            '- If the payment cannot be posted cleanly, stop before recording the transaction.',
            '- If a mistake is discovered later, correct it through a new compensating workflow and never by editing the original transaction.',
        ],
    },
    finance_record_outgoing_txn: {
        businessOutcome: 'Record outgoing business payments by placing them under the correct work context, with follow-up questions when context is incomplete.',
        whenThisRuns: [
            '- Manual run: when the business needs to record a real outgoing payment.',
            '- This SOP should run only when property, payee, amount, and enough work context are available.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff, Caretaker',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Capture outgoing request context.',
            '   Record who is raising the outgoing request, payment reason, amount, mode, and date.',
            '2. Validate work placement.',
            '   Check that the outgoing payment can be attached to the correct work or expense context safely. Ask follow-up questions instead of guessing when more than one interpretation is possible.',
            '3. Record the outgoing transaction in Finance.',
            '   Create the outgoing transaction with the approved payment details and preserve it as the final money-movement truth.',
            '4. Handle caretaker reimbursement safely.',
            '   If caretaker raises business spend, keep it pending reimbursement until CEO approval for next reimbursement cycle.',
            '5. Link the internal work structure.',
            '   Reuse or create the internal work context underneath the transaction so vendor linkage, purchases, payments, and settlement history stay connected over time.',
            '6. Return the placement outcome.',
            '   Return the recorded outgoing transaction and where it was placed internally so the business can review it later.',
        ],
        preconditions: [
            '- Property is identified.',
            '- Vendor or payee is clear.',
            '- Payment details are complete.',
            '- Work context is clear enough to avoid accidental misplacement.',
        ],
        rollback: [
            '- If the context is ambiguous, stop and ask follow-up questions before recording the transaction.',
            '- Do not reimburse caretaker spending without CEO approval.',
            '- Later corrections must be captured through new compensating records, never by editing the original transaction.',
        ],
    },
    finance_onboard_tenant_contract: {
        businessOutcome: 'Take the approved tenant commercial terms and store them in Finance as the contract the business will bill against.',
        whenThisRuns: [
            '- Manual run: when CEO or an approved SOP needs to lock negotiated tenant terms into Finance.',
            '- This SOP should run only when the tenant, effective date, rent, and deposit terms are confirmed.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm the contract scope.',
            '   Identify the tenant, the property or unit, the commercial terms, and the date from which those terms should become effective.',
            '2. Review the approved terms.',
            '   Make sure the negotiated rent, deposit, utility timing, and contract window are complete and approved before anything is stored.',
            '3. Record the contract in Finance.',
            '   Save the approved terms as the finance contract for this tenant so monthly billing and dues can rely on one commercial truth.',
            '4. Return the contract outcome.',
            '   Confirm which contract was stored, from which date it applies, and what the business can do next with it.',
        ],
        preconditions: [
            '- Tenant is identified.',
            '- Effective date is known.',
            '- Commercial terms are approved and complete.',
        ],
        rollback: [
            '- If contract terms are incomplete, stop before storing anything.',
            '- Do not partially write contract state.',
        ],
    },
    finance_complete_onboarding_from_booking: {
        businessOutcome: 'Take an active booking hold, complete onboarding from the approved start date, and apply the held money correctly into the final resident contract setup.',
        whenThisRuns: [
            '- Manual run: when the CEO finalizes onboarding from an existing booking hold.',
            '- This SOP should run only when the booking hold, onboarding date, final unit, and commercial terms are confirmed.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm the booking hold that will be converted.',
            '   Check the active booking hold, the resident, the amount held, and the business decision to move ahead with onboarding.',
            '2. Confirm the final onboarding details.',
            '   Capture the final unit, onboarding date, rent, deposit, and any timing rules that apply from the onboarding date.',
            '3. Apply the held money to the onboarding decision.',
            '   Use the booking hold in the approved commercial manner so it is reflected correctly once onboarding is completed.',
            '4. Create the live contract outcome.',
            '   Store the tenant contract and return the onboarding result, including the unit, date, and commercial setup now in effect.',
        ],
        preconditions: [
            '- A valid active booking hold exists.',
            '- Onboarding date is approved.',
            '- Final unit and commercial terms are complete.',
        ],
        rollback: [
            '- If unit assignment or contract creation cannot be completed cleanly, stop before recording the final onboarding result.',
            '- Do not partially complete onboarding.',
        ],
    },
    finance_expire_booking_hold: {
        businessOutcome: 'System-run SOP that closes booking holds whose onboarding validity window ended without onboarding completion, while preserving booking amount audit visibility.',
        whenThisRuns: [
            '- Scheduled run: every day at 9:00 PM IST.',
            '- System run checks active holds and expires only eligible ones.',
        ],
        whoCanInitiateAndApprove: [
            '- Started by: System',
            '- Approval: governed by approved live SOP policy',
        ],
        detailedFlow: [
            '1. Review active booking holds.',
            '   Check all booking holds that are still open and identify which ones may have crossed the allowed validity window.',
            '2. Confirm expiry eligibility.',
            '   Make sure the hold is still active and was not already converted into onboarding or closed in another process.',
            '3. Record the expiry result in Finance.',
            '   Mark the booking hold as expired according to the business rule and keep the finance record auditable for later review.',
            '4. Preserve amount visibility and status.',
            '   Keep the original booking receipt visible to business while moving hold status from active to expired/forfeited.',
            '5. Return the expiry outcome.',
            '   Show which holds were closed, which were skipped, and what follow-up is required next.',
        ],
        preconditions: [
            '- A booking hold exists and is still active.',
            '- The validity window has actually ended.',
            '- The hold is not already closed or converted.',
        ],
        rollback: [
            '- If a hold is already closed or cannot be resolved deterministically, stop.',
            '- Do not expire a hold that has already been converted into onboarding.',
        ],
    },
    finance_offboard_tenant: {
        businessOutcome: 'Close tenant offboarding only after final settlement is calculated, money movement is completed, CEO comment is captured, and final customer message is sent.',
        whenThisRuns: [
            '- Manual run: when tenant move-out settlement is being closed.',
            '- This SOP enforces notice/min-stay rule checks from rate card before closure.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff',
            '- Final closure approval: CEO',
        ],
        detailedFlow: [
            '1. Confirm move-out request and tenant context.',
            '   Identify tenant, move-out date, and property/unit details for settlement.',
            '2. Apply notice and minimum-stay rules.',
            '   Evaluate rate-card notice and min-stay impact in final calculation.',
            '3. Calculate final settlement position.',
            '   Determine surplus, deficit, or zero outcome with all final adjustments.',
            '4. Execute settlement money movement.',
            '   CEO receives or sends money as applicable, and accounts are updated inside this SOP.',
            '5. Capture CEO closure comment and close offboarding.',
            '   Record closure rationale and close only after settlement movement is complete.',
            '6. Send mandatory final customer message.',
            '   Share final settlement details with the customer as required completion communication.',
        ],
        preconditions: [
            '- Tenant and move-out date are identified.',
            '- Rate-card notice/min-stay context is available.',
            '- Settlement direction and amount are clear.',
        ],
        rollback: [
            '- Do not close offboarding before settlement movement is completed unless balance is zero.',
            '- Keep full audit trail; do not erase prior billing or payment history.',
        ],
    },
    finance_add_vendor: {
        businessOutcome: 'Create or reuse a vendor in the finance register so outgoing payments and expenses can be tracked against the right payee.',
        whenThisRuns: [
            '- Manual run: when the business needs a vendor record before expense posting or settlement.',
            '- This SOP should run only when the vendor identity is clear enough to avoid duplicates.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm the vendor identity.',
            '   Capture the vendor name, contact details, payment details, and business category needed for finance tracking.',
            '2. Check whether the vendor already exists.',
            '   Look for a clear existing match so the business does not create duplicate vendor records.',
            '3. Create or reuse the vendor record.',
            '   Register the vendor if needed or reuse the existing one when the payee is already on file.',
            '4. Return the vendor result.',
            '   Share the vendor record that should be used by later outgoing-payment procedures.',
        ],
        preconditions: [
            '- Vendor identity is clear.',
            '- Enough contact or payment details are available to avoid duplicates.',
        ],
        rollback: [
            '- If vendor identity is too ambiguous, stop before creating the record.',
            '- Do not create duplicate vendor records when an existing one clearly matches.',
        ],
    },
    finance_add_ledger_entry: {
        businessOutcome: 'Add one approved manual debit entry to the ledger without changing prior ledger history.',
        whenThisRuns: [
            '- Manual run: when an approved debit must be added for a tenant or payer.',
            '- This SOP should run only when payer, category, amount, and month context are clear.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm the debit request.',
            '   Identify the payer, amount, billing month, category, and the approved reason for the debit.',
            '2. Check that the debit is safe to record.',
            '   Make sure the debit belongs to the correct payer and month so it does not distort another account.',
            '3. Add the ledger entry.',
            '   Create one new debit entry and preserve the ledger as append-only history.',
            '4. Return the ledger outcome.',
            '   Confirm the new entry and the payer account it now affects.',
        ],
        preconditions: [
            '- Payer is identified.',
            '- Category, amount, and month are known.',
            '- Approval context is complete.',
        ],
        rollback: [
            '- If payer or amount is ambiguous, stop before writing the entry.',
            '- Never edit prior ledger state to compensate for a bad debit.',
        ],
    },
    finance_process_salary_payout: {
        businessOutcome: 'Process an approved salary payout cycle so the finance record shows which staff payments were completed for the target payroll month.',
        whenThisRuns: [
            '- Scheduled run: on the configured salary date for the payroll cycle.',
            '- Manual run: when the business needs to complete an approved payroll payout.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO, Staff, System',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Confirm the payroll scope.',
            '   Identify the staff members, the payroll month, and the approved salary values that should be paid in this cycle.',
            '2. Review payout readiness.',
            '   Check that bank details, salary cards, and approval context are complete before any payout posting begins.',
            '3. Record the salary payout.',
            '   Process the payout in Finance so the business can see who has been paid and for which month.',
            '4. Return the payroll outcome.',
            '   Confirm the payout result, including which payment records were created and what follow-up is still pending.',
        ],
        preconditions: [
            '- Payroll month is known.',
            '- Active salary card exists.',
            '- Bank details and approval are complete.',
        ],
        rollback: [
            '- If salary inputs are incomplete, stop before payout posting.',
            '- Do not mark salary as paid on partial failure.',
        ],
    },
    finance_record_correction_txn: {
        businessOutcome: 'Correct a prior finance result by creating a new compensating transaction instead of editing the original record.',
        whenThisRuns: [
            '- Manual run: when a previous finance transaction is wrong and must be corrected without changing the original record.',
            '- This SOP should run only when the original transaction and the correction reason are fully known.',
        ],
        whoCanInitiateAndApprove: [
            '- Can start: CEO',
            '- Approval needed: CEO',
        ],
        detailedFlow: [
            '1. Identify the original transaction.',
            '   Confirm which finance transaction is wrong and why the business believes a correction is needed.',
            '2. Confirm the correction direction.',
            '   Decide how much should be corrected, in which direction, and for what approved reason.',
            '3. Create the compensating transaction.',
            '   Add a new correction transaction that offsets or adjusts the original result without editing past records.',
            '4. Link the correction for audit.',
            '   Connect the correction to the original transaction so the finance trail remains complete and reviewable.',
            '5. Send confirmation to CEO.',
            '   Share correction reference, applied effect, and updated position with CEO.',
        ],
        preconditions: [
            '- Original transaction is identified.',
            '- Correction amount and reason are clear.',
            '- Approval context is complete.',
        ],
        rollback: [
            '- Never edit the original transaction.',
            '- Stop if the original record cannot be resolved or the correction payload is incomplete.',
        ],
    },
};

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function inferTriggerType(workflow = {}) {
    if (WORKFLOW_TRIGGER_TYPES.has(workflow.trigger_type)) {
        return workflow.trigger_type;
    }
    if (isPlainObject(workflow.schedule)) return 'schedule';
    if (workflow.intent_rule || workflow.intent_description) return 'intent';
    return 'event';
}

function extractVersion(workflowId = '') {
    const match = String(workflowId).match(/_(v\d+)$/i);
    return match ? match[1].toLowerCase() : 'v1';
}

function deriveWorkflowFamily(workflowId = '') {
    return String(workflowId || '').replace(/_v\d+$/i, '') || String(workflowId || '');
}

function toLines(value) {
    if (Array.isArray(value)) return value.map((line) => String(line || '').trim()).filter(Boolean);
    return String(value || '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean);
}

function buildDefaultUserView(workflow = {}) {
    const title = workflow.user_view_title || workflow.name || workflow.workflow_id || 'Workflow';
    const preset = SOP_DOCUMENT_PRESETS[workflow.workflow_family || deriveWorkflowFamily(workflow.workflow_id)];
    const presetSteps = preset
        ? preset.detailedFlow
            .filter((line) => /^\d+\./.test(line))
            .map((line) => line.replace(/^\d+\.\s*/, '').trim())
        : [];
    const steps = Array.isArray(workflow.user_view_steps) && workflow.user_view_steps.length > 0
        ? workflow.user_view_steps
        : presetSteps.length > 0
            ? presetSteps
            : (Array.isArray(workflow.steps) ? workflow.steps : [])
                .map((step) => String(step?.description || '').trim())
                .filter(Boolean);

    return {
        title,
        steps: steps.length > 0 ? steps : ['Review the business procedure and make the expected outcome explicit before publish.'],
    };
}

function normalizeApprovalSurfaces(surfaces = [], workflow = {}) {
    const filtered = Array.isArray(surfaces)
        ? surfaces
            .map((surface) => String(surface || '').trim())
            .map((surface) => (/^gui chat$/i.test(surface) ? 'SOP Workspace' : surface))
            .filter(Boolean)
            .filter((surface) => !/whatsapp/i.test(surface))
        : [];

    if (filtered.length > 0) {
        return Array.from(new Set(filtered));
    }

    if (workflow.domain === 'finance') {
        return [...SOP_GOVERNANCE_SURFACES];
    }

    return ['SOP Workspace'];
}

function buildDefaultApproval(workflow = {}) {
    if (isPlainObject(workflow.approval)) {
        return {
            required: Boolean(workflow.approval.required),
            initiators: Array.isArray(workflow.approval.initiators) ? workflow.approval.initiators : [],
            approvers: Array.isArray(workflow.approval.approvers) ? workflow.approval.approvers : [],
            surfaces: normalizeApprovalSurfaces(workflow.approval.surfaces, workflow),
            response_format: workflow.approval.response_format || null,
        };
    }

    if (workflow.domain === 'finance') {
        return {
            required: true,
            initiators: ['CEO', 'Staff', 'System'],
            approvers: ['CEO'],
            surfaces: [...SOP_GOVERNANCE_SURFACES],
            response_format: 'yes_no_optional_note',
        };
    }

    return {
        required: false,
        initiators: ['CEO'],
        approvers: [],
        surfaces: ['SOP Workspace'],
        response_format: null,
    };
}

function buildDefaultConfidence(workflow = {}) {
    if (isPlainObject(workflow.confidence)) {
        return {
            level: workflow.confidence.level || 'standard',
            rule: workflow.confidence.rule || '',
        };
    }

    if (workflow.domain === 'finance') {
        return {
            level: 'very_high',
            rule: 'Finance execution must not proceed until payer or payee, amount, target record, and approval context are unambiguous.',
        };
    }

    return {
        level: 'standard',
        rule: 'Ask follow-up questions whenever trigger, target record, or side effects are ambiguous.',
    };
}

function buildDefaultRollback(workflow = {}) {
    if (isPlainObject(workflow.rollback_policy)) {
        return {
            rule: workflow.rollback_policy.rule || '',
            mode: workflow.rollback_policy.mode || 'abort',
        };
    }

    const hasMultipleSteps = Array.isArray(workflow.steps) && workflow.steps.length > 1;
    return {
        mode: 'abort',
        rule: hasMultipleSteps
            ? 'Abort on the first failed step and preserve prior completed steps for explicit operator review.'
            : 'Abort on failure and leave no partial hidden state.',
    };
}

function buildDefaultSopDocument(workflow = {}) {
    const workflowFamily = workflow.workflow_family || deriveWorkflowFamily(workflow.workflow_id);
    const preset = SOP_DOCUMENT_PRESETS[workflowFamily];
    const approval = buildDefaultApproval(workflow);
    const schedule = workflow.schedule || {};
    const userView = buildDefaultUserView(workflow);
    const baseTitle = workflow.name || workflow.user_view_title || workflow.workflow_id || 'Untitled SOP';

    if (preset) {
        const scopeLines = [
            `- Scope: ${schedule.scope || 'Business scope defined by this SOP.'}`,
            `- Owner: ${workflow.module_owner || workflow.domain || 'Not specified'}`,
        ];
        return {
            title: baseTitle,
            sections: [
                { key: 'business_outcome', title: 'Business outcome', content: preset.businessOutcome },
                { key: 'when_this_runs', title: 'When this runs', content: preset.whenThisRuns.join('\n') },
                { key: 'who_can_initiate_and_approve', title: 'Who can initiate and approve', content: preset.whoCanInitiateAndApprove.join('\n') },
                { key: 'detailed_flow', title: 'Detailed flow', content: preset.detailedFlow.join('\n') },
                { key: 'preconditions', title: 'Preconditions', content: preset.preconditions.join('\n') },
                { key: 'failure_and_rollback_policy', title: 'Failure and rollback policy', content: preset.rollback.join('\n') },
                { key: 'scope_and_ownership', title: 'Scope and ownership', content: scopeLines.join('\n') },
            ],
            advanced: {
                workflow_id: workflow.workflow_id || null,
                module_owner: workflow.module_owner || workflow.domain || null,
                version: workflow.version || null,
                system_default: Boolean(workflow.version_type === 'system_template' || workflow.protected),
            },
        };
    }

    const whenLines = [];
    if (workflow.trigger_type === 'schedule' && schedule) {
        const runTime = schedule.run_time ? `${schedule.run_time} ${schedule.timezone || ''}`.trim() : 'Not specified';
        whenLines.push(`- Scheduled run: ${schedule.run_rule || schedule.frequency || 'Scheduled'} at ${runTime}.`);
    }
    if (workflow.trigger_description || workflow.intent_description || workflow.intent_rule) {
        whenLines.push(`- Manual run: ${workflow.trigger_description || workflow.intent_description || workflow.intent_rule}`);
    }
    if (whenLines.length === 0) {
        whenLines.push('- Run timing has not been described yet.');
    }

    const flowLines = userView.steps.map((line, index) => `${index + 1}. ${line}`);
    return {
        title: baseTitle,
        sections: [
            { key: 'business_outcome', title: 'Business outcome', content: workflow.description || 'Describe what this SOP should achieve for the business.' },
            { key: 'when_this_runs', title: 'When this runs', content: whenLines.join('\n') },
            {
                key: 'who_can_initiate_and_approve',
                title: 'Who can initiate and approve',
                content: [
                    `- Can start: ${Array.isArray(approval.initiators) && approval.initiators.length > 0 ? approval.initiators.join(', ') : 'Not specified'}`,
                    `- Approval needed: ${approval.required ? (approval.approvers?.join(', ') || 'Required') : 'Not required'}`,
                ].join('\n'),
            },
            { key: 'detailed_flow', title: 'Detailed flow', content: flowLines.join('\n') || '1. Describe the operating flow.' },
            { key: 'preconditions', title: 'Preconditions', content: workflow.confidence?.rule ? `- ${workflow.confidence.rule}` : '- No preconditions have been described yet.' },
            { key: 'failure_and_rollback_policy', title: 'Failure and rollback policy', content: workflow.rollback_policy?.rule ? `- ${workflow.rollback_policy.rule}` : '- No failure rule has been described yet.' },
            {
                key: 'scope_and_ownership',
                title: 'Scope and ownership',
                content: [
                    `- Scope: ${schedule.scope || 'Not specified'}`,
                    `- Owner: ${workflow.module_owner || workflow.domain || 'Not specified'}`,
                ].join('\n'),
            },
        ],
        advanced: {
            workflow_id: workflow.workflow_id || null,
            module_owner: workflow.module_owner || workflow.domain || null,
            version: workflow.version || null,
            system_default: Boolean(workflow.version_type === 'system_template' || workflow.protected),
        },
    };
}

function normalizeSopDocument(value, workflow = {}) {
    if (isPlainObject(value) && Array.isArray(value.sections) && value.sections.length > 0) {
        return {
            title: String(value.title || workflow.name || workflow.workflow_id || 'Untitled SOP').trim(),
            sections: value.sections.map((section, index) => ({
                key: String(section.key || `section_${index + 1}`).trim(),
                title: String(section.title || `Section ${index + 1}`).trim(),
                content: toLines(section.content).join('\n'),
            })),
            advanced: isPlainObject(value.advanced) ? { ...value.advanced } : {},
        };
    }
    return buildDefaultSopDocument(workflow);
}

function inferLegacyVersionType(workflow = {}, allWorkflows = []) {
    const explicit = String(workflow.version_type || '').trim();
    if (WORKFLOW_VERSION_TYPES.has(explicit)) {
        return explicit;
    }

    const tenantId = String(workflow.tenant_id || '').trim() || null;
    if (!tenantId && workflow.protected) {
        return 'system_template';
    }

    if (tenantId && workflow.is_active) {
        return 'tenant_published';
    }

    if (tenantId) {
        const hasSiblingPublished = allWorkflows.some((candidate) => (
            candidate.workflow_id !== workflow.workflow_id
            && String(candidate.tenant_id || '').trim() === tenantId
            && (candidate.workflow_family || deriveWorkflowFamily(candidate.workflow_id)) === (workflow.workflow_family || deriveWorkflowFamily(workflow.workflow_id))
            && (candidate.version_type === 'tenant_published' || candidate.is_active)
        ));
        return hasSiblingPublished ? 'archived_snapshot' : 'tenant_draft';
    }

    return 'system_template';
}

function syncLegacyLifecycleFields(workflow = {}, now) {
    const next = { ...workflow };
    const versionType = WORKFLOW_VERSION_TYPES.has(next.version_type)
        ? next.version_type
        : inferLegacyVersionType(next);

    next.version_type = versionType;

    if (versionType === 'system_template') {
        next.tenant_id = null;
        next.protected = true;
        next.is_active = false;
        next.validation_status = next.validation_status || 'validated';
        next.published_at = null;
        next.archived_at = null;
    }

    if (versionType === 'tenant_draft') {
        next.protected = false;
        next.is_active = false;
        next.validation_status = next.validation_status || 'draft';
        next.published_at = null;
        next.archived_at = null;
    }

    if (versionType === 'tenant_published') {
        next.protected = false;
        next.is_active = true;
        next.validation_status = 'validated';
        next.published_at = next.published_at || next.updated_at || now;
        next.archived_at = null;
    }

    if (versionType === 'archived_snapshot') {
        next.protected = false;
        next.is_active = false;
        next.validation_status = 'validated';
        next.archived_at = next.archived_at || next.updated_at || now;
    }

    return next;
}

function normalizeWorkflowDefinition(input = {}, options = {}) {
    const now = options.now || TimeAuthorityService.nowIST();
    const existing = options.existingWorkflow || null;
    const existingWorkflows = Array.isArray(options.existingWorkflows) ? options.existingWorkflows : [];
    const allowIncomplete = Boolean(options.allowIncomplete);
    const preserveTimestamps = Boolean(options.preserveTimestamps);
    const merged = { ...(existing || {}), ...(input || {}) };
    const workflowId = String(merged.workflow_id || '').trim();
    const triggerType = inferTriggerType(merged);
    const userView = buildDefaultUserView(merged);
    const inferredVersionType = inferLegacyVersionType(merged, existingWorkflows);

    let normalized = {
        ...existing,
        ...input,
        workflow_id: workflowId,
        name: String(merged.name ?? '').trim(),
        description: String(merged.description ?? '').trim(),
        domain: String(merged.domain ?? '').trim() || null,
        module_owner: String(merged.module_owner ?? merged.domain ?? '').trim() || null,
        version: String(merged.version ?? extractVersion(workflowId)).trim(),
        workflow_family: String(merged.workflow_family ?? deriveWorkflowFamily(workflowId)).trim(),
        trigger_type: triggerType,
        trigger_event: String(merged.trigger_event ?? '').trim(),
        trigger_description: String(merged.trigger_description ?? '').trim(),
        schedule: isPlainObject(merged.schedule) ? merged.schedule : null,
        intent_rule: String(merged.intent_rule ?? '').trim() || null,
        intent_description: String(merged.intent_description ?? '').trim() || null,
        steps: Array.isArray(merged.steps) ? merged.steps : [],
        approval: buildDefaultApproval(merged),
        confidence: buildDefaultConfidence(merged),
        rollback_policy: buildDefaultRollback(merged),
        user_view_title: String(merged.user_view_title ?? userView.title).trim(),
        user_view_steps: Array.isArray(merged.user_view_steps) && merged.user_view_steps.length > 0
            ? merged.user_view_steps
            : userView.steps,
        deterministic: Boolean(merged.deterministic),
        tenant_id: String(merged.tenant_id ?? '').trim() || null,
        clone_of_workflow_id: String(merged.clone_of_workflow_id ?? '').trim() || null,
        version_type: String(merged.version_type || inferredVersionType).trim() || inferredVersionType,
        published_at: merged.published_at || null,
        archived_at: merged.archived_at || null,
        replaced_workflow_id: String(merged.replaced_workflow_id ?? '').trim() || null,
        ui_hidden: Boolean(merged.ui_hidden),
        created_at: existing?.created_at || merged.created_at || now,
        updated_at: preserveTimestamps ? (existing?.updated_at || merged.updated_at || now) : now,
        validation_status: String(merged.validation_status || '').trim() || (allowIncomplete ? 'draft' : 'validated'),
    };

    normalized = syncLegacyLifecycleFields(normalized, now);
    normalized.sop_document = normalizeSopDocument(merged.sop_document, normalized);

    if (normalized.version_type === 'tenant_draft' && !normalized.name && allowIncomplete) {
        normalized.name = 'Untitled SOP Draft';
    }

    return normalized;
}

function validateWorkflowDefinition(workflow = {}, options = {}) {
    const errors = [];
    const warnings = [];
    const existingWorkflows = Array.isArray(options.existingWorkflows) ? options.existingWorkflows : [];
    const isUpdate = Boolean(options.isUpdate);
    const mode = options.mode || 'publish';

    if (mode === 'draft') {
        if (!workflow.workflow_id) errors.push('workflow_id is required.');
        if (!workflow.workflow_family) errors.push('workflow_family is required.');
        return {
            ok: errors.length === 0,
            errors,
            warnings,
        };
    }

    if (!workflow.workflow_id) errors.push('workflow_id is required.');
    if (!workflow.name) errors.push('name is required.');
    if (!workflow.description) errors.push('description is required.');
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
        errors.push('At least one workflow step is required.');
    }

    if (!WORKFLOW_TRIGGER_TYPES.has(workflow.trigger_type)) {
        errors.push('trigger_type must be one of: event, schedule, intent.');
    }

    if (workflow.trigger_type === 'event' && !workflow.trigger_event) {
        errors.push('trigger_event is required for event-triggered workflows.');
    }

    if (workflow.trigger_type === 'schedule' && !isPlainObject(workflow.schedule)) {
        errors.push('schedule is required for timer-triggered workflows.');
    }

    if (workflow.trigger_type === 'intent' && !workflow.intent_rule && !workflow.intent_description && !workflow.trigger_description) {
        errors.push('intent-driven workflows require intent_rule, intent_description, or trigger_description.');
    }

    if (!workflow.workflow_family) errors.push('workflow_family is required.');
    if (!workflow.user_view_title) errors.push('user_view_title is required.');
    if (!Array.isArray(workflow.user_view_steps) || workflow.user_view_steps.length === 0) {
        errors.push('user_view_steps must contain at least one plain-English step.');
    }
    if (!isPlainObject(workflow.approval)) errors.push('approval rule is required.');
    if (!isPlainObject(workflow.confidence)) errors.push('confidence rule is required.');
    if (!isPlainObject(workflow.rollback_policy)) errors.push('rollback_policy is required.');
    if (!isPlainObject(workflow.sop_document) || !Array.isArray(workflow.sop_document.sections) || workflow.sop_document.sections.length === 0) {
        errors.push('sop_document must contain readable SOP sections.');
    }

    (Array.isArray(workflow.steps) ? workflow.steps : []).forEach((step, index) => {
        if (!step?.step_id) errors.push(`steps[${index}].step_id is required.`);
        if (!step?.agent) errors.push(`steps[${index}].agent is required.`);
        if (!step?.tool) errors.push(`steps[${index}].tool is required.`);
        if (!isPlainObject(step?.params)) errors.push(`steps[${index}].params must be an object.`);
        if (!step?.on_failure) errors.push(`steps[${index}].on_failure is required.`);
    });

    const duplicateId = existingWorkflows.find((candidate) => (
        candidate.workflow_id === workflow.workflow_id
        && (!isUpdate || candidate.workflow_id !== options.existingWorkflowId)
    ));
    if (duplicateId) {
        errors.push(`workflow_id '${workflow.workflow_id}' already exists.`);
    }

    if (workflow.domain === 'finance') {
        if (!workflow.deterministic) {
            errors.push('Finance workflows must be deterministic.');
        }
        if (!workflow.approval?.required) {
            errors.push('Finance workflows must declare a mandatory approval rule.');
        }
        if (!workflow.rollback_policy?.rule) {
            errors.push('Finance workflows must declare a rollback or failure rule.');
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
    };
}

function buildWorkflowClone(template = {}, options = {}) {
    const tenantId = String(options.tenant_id || '').trim();
    const now = options.now || TimeAuthorityService.nowIST();
    const cloneId = options.workflow_id || `${template.workflow_family || deriveWorkflowFamily(template.workflow_id)}_${tenantId}_draft_${Date.now()}`;
    return normalizeWorkflowDefinition({
        ...template,
        workflow_id: cloneId,
        tenant_id: tenantId,
        protected: false,
        clone_of_workflow_id: template.workflow_id,
        version_type: 'tenant_draft',
        published_at: null,
        archived_at: null,
        validation_status: 'draft',
        created_at: now,
        updated_at: now,
    }, { now, allowIncomplete: true });
}

function buildBlankWorkflowDraft(options = {}) {
    const tenantId = String(options.tenant_id || '').trim();
    const now = options.now || TimeAuthorityService.nowIST();
    const family = String(options.workflow_family || `draft_${Date.now()}`).trim();
    const workflowId = String(options.workflow_id || `${family}_${tenantId || 'tenant'}_draft_${Date.now()}`).trim();
    const name = String(options.name || '').trim();

    return normalizeWorkflowDefinition({
        workflow_id: workflowId,
        workflow_family: family,
        tenant_id: tenantId,
        name,
        description: '',
        domain: options.domain || null,
        module_owner: options.module_owner || options.domain || null,
        trigger_type: options.trigger_type || 'intent',
        trigger_description: '',
        steps: [],
        approval: options.approval || null,
        confidence: options.confidence || null,
        rollback_policy: options.rollback_policy || null,
        version_type: 'tenant_draft',
        sop_document: {
            title: name || 'Untitled SOP Draft',
            sections: [
                { key: 'business_outcome', title: 'Business outcome', content: '' },
                { key: 'when_this_runs', title: 'When this runs', content: '' },
                { key: 'who_can_initiate_and_approve', title: 'Who can initiate and approve', content: '' },
                { key: 'detailed_flow', title: 'Detailed flow', content: '' },
                { key: 'preconditions', title: 'Preconditions', content: '' },
                { key: 'failure_and_rollback_policy', title: 'Failure and rollback policy', content: '' },
                { key: 'scope_and_ownership', title: 'Scope and ownership', content: '' },
            ],
        },
        created_at: now,
        updated_at: now,
        validation_status: 'draft',
    }, { now, allowIncomplete: true });
}

function upgradeWorkflowCollection(workflows = [], options = {}) {
    const now = options.now || TimeAuthorityService.nowIST();
    return (Array.isArray(workflows) ? workflows : []).map((workflow) => (
        normalizeWorkflowDefinition(workflow, {
            existingWorkflow: workflow,
            existingWorkflows: workflows,
            now,
            allowIncomplete: true,
            preserveTimestamps: true,
        })
    ));
}

function publishWorkflowVersion(workflows = [], workflowId, tenantId, options = {}) {
    const now = options.now || TimeAuthorityService.nowIST();
    const normalizedTenantId = String(tenantId || '').trim() || null;
    const next = upgradeWorkflowCollection(workflows, { now }).map((workflow) => ({ ...workflow }));
    const target = next.find((workflow) => workflow.workflow_id === workflowId && workflow.tenant_id === normalizedTenantId);

    if (!target) {
        throw new Error(`Workflow '${workflowId}' not found for tenant '${normalizedTenantId}'.`);
    }
    if (target.version_type !== 'tenant_draft') {
        throw new Error('Only tenant drafts can be published.');
    }

    const validation = validateWorkflowDefinition(target, {
        existingWorkflows: next.filter((workflow) => workflow.workflow_id !== target.workflow_id),
        isUpdate: true,
        existingWorkflowId: target.workflow_id,
        mode: 'publish',
    });
    if (!validation.ok) {
        throw new Error(validation.errors.join(' '));
    }

    next.forEach((workflow) => {
        if (
            workflow.tenant_id === normalizedTenantId
            && workflow.workflow_family === target.workflow_family
            && workflow.workflow_id !== target.workflow_id
            && workflow.version_type === 'tenant_published'
        ) {
            workflow.version_type = 'archived_snapshot';
            workflow.replaced_workflow_id = target.workflow_id;
            workflow.updated_at = now;
            workflow.archived_at = now;
            workflow.is_active = false;
        }
    });

    target.version_type = 'tenant_published';
    target.validation_status = 'validated';
    target.updated_at = now;
    target.published_at = now;
    target.archived_at = null;
    target.is_active = true;

    return { workflows: next, workflow: target };
}

function archiveWorkflowVersion(workflows = [], workflowId, tenantId, options = {}) {
    const now = options.now || TimeAuthorityService.nowIST();
    const normalizedTenantId = String(tenantId || '').trim() || null;
    const next = upgradeWorkflowCollection(workflows, { now }).map((workflow) => ({ ...workflow }));
    const target = next.find((workflow) => workflow.workflow_id === workflowId && workflow.tenant_id === normalizedTenantId);

    if (!target) {
        throw new Error(`Workflow '${workflowId}' not found for tenant '${normalizedTenantId}'.`);
    }
    if (target.version_type !== 'tenant_published') {
        throw new Error('Only published tenant workflows can be archived.');
    }

    target.version_type = 'archived_snapshot';
    target.updated_at = now;
    target.archived_at = now;
    target.is_active = false;

    return { workflows: next, workflow: target };
}

function discardWorkflowDraft(workflows = [], workflowId, tenantId, options = {}) {
    const normalizedTenantId = String(tenantId || '').trim() || null;
    const next = upgradeWorkflowCollection(workflows, options);
    const index = next.findIndex((workflow) => workflow.workflow_id === workflowId && workflow.tenant_id === normalizedTenantId);
    if (index === -1) {
        throw new Error(`Workflow '${workflowId}' not found for tenant '${normalizedTenantId}'.`);
    }
    if (next[index].version_type !== 'tenant_draft') {
        throw new Error('Only tenant drafts can be discarded.');
    }
    const [removed] = next.splice(index, 1);
    return { workflows: next, workflow: removed };
}

function resolveEffectiveWorkflow(workflows = [], workflowFamily, tenantId) {
    const normalizedTenantId = String(tenantId || '').trim() || null;
    const familyRows = upgradeWorkflowCollection(workflows).filter((workflow) => workflow.workflow_family === workflowFamily);
    const tenantPublished = familyRows.find((workflow) => workflow.tenant_id === normalizedTenantId && workflow.version_type === 'tenant_published');
    if (tenantPublished) return tenantPublished;
    const tenantActiveLegacy = familyRows.find((workflow) => workflow.tenant_id === normalizedTenantId && workflow.is_active);
    if (tenantActiveLegacy) return tenantActiveLegacy;
    return familyRows.find((workflow) => workflow.version_type === 'system_template' || (!workflow.tenant_id && workflow.protected)) || null;
}

module.exports = {
    SOP_GOVERNANCE_SURFACES,
    WORKFLOW_TRIGGER_TYPES,
    WORKFLOW_VERSION_TYPES,
    normalizeWorkflowDefinition,
    validateWorkflowDefinition,
    buildWorkflowClone,
    buildBlankWorkflowDraft,
    buildDefaultSopDocument,
    deriveWorkflowFamily,
    extractVersion,
    publishWorkflowVersion,
    archiveWorkflowVersion,
    discardWorkflowDraft,
    resolveEffectiveWorkflow,
    upgradeWorkflowCollection,
};
