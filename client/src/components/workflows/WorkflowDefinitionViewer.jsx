import React from 'react';
import { ArrowLeft, Power, PowerOff } from 'lucide-react';

const toArray = (value) => (Array.isArray(value) ? value : []);

const WORKFLOW_DEFINITION_PRESETS = {
    finance_generate_monthly_bills: {
        businessOutcome: [
            "For the target month, create each tenant's bill from contract terms, write finance truth (ledger-backed bill entries), and produce bill output that can be sent to the customer.",
        ],
        whenThisRuns: [
            '- Scheduled run: last day of every month at 10:00 PM IST.',
            '- Manual run: when CEO/System requests monthly billing.',
        ],
        whoCanInitiateAndApprove: [
            '- Initiators: CEO, System',
            '- Approval: CEO required',
        ],
        detailedFlow: [
            '1. Resolve billing scope',
            '   - Identify target month and payer scope.',
            '   - Validate payer/property context is clear before calculation starts.',
            '2. Load contract truth',
            '   - Read active contract details from Finance for each target payer.',
            '   - Pull commercial terms: rent, utility timing, deposits/dues context.',
            '3. Calculate bill lines',
            '   - Compute monthly payable components from contract/rate card rules.',
            '   - Apply prorata where contract validity requires partial-month billing.',
            '   - Build itemized bill lines for transparent customer view.',
            '4. Write finance truth',
            '   - Persist bill entries to ledger-backed finance records.',
            '   - Generate stable ledger/bill IDs for audit and downstream use.',
            '5. Produce bill output',
            '   - Return structured bill output for communication channels.',
            '   - Output includes references needed for PDF/link delivery flows.',
            '6. Hand off to communication/CRM layers',
            '   - Workflow allows message/CRM projection steps after finance truth.',
            '   - If those fail, finance entries remain intact (no truth rollback).',
        ],
        preconditions: [
            '- Active tenant contract exists.',
            '- Billing month is explicitly known.',
            '- Payer scope is unambiguous.',
        ],
        rollback: [
            '- Missing contract/month: abort before any ledger write.',
            '- Communication/CRM failure after finance write: do not erase finance truth; handle failure as follow-up action.',
        ],
        scope: [
            '- Scope: all active tenant contracts',
            '- Module owner: Finance',
            '- Version: v1',
            '- Protected default: Yes',
        ],
    },
    finance_record_incoming_txn: {
        businessOutcome: [
            "Record a real incoming payment against the correct payer, allocate it in Finance, and preserve the original transaction as immutable finance truth.",
        ],
        whenThisRuns: [
            '- Intent run: when CEO or staff needs to post an incoming payment after business confirmation.',
            '- Execution happens only when payer, amount, mode, and allocation context are sufficiently clear.',
        ],
        whoCanInitiateAndApprove: [
            '- Initiators: CEO, Staff',
            '- Approval: CEO required',
        ],
        detailedFlow: [
            '1. Resolve payer and payment context',
            '   - Identify the payer account, amount, mode, date, and any linked property or unit context.',
            '   - Confirm this is the correct incoming payment before posting it.',
            '2. Validate payment posting confidence',
            '   - Check that payer, amount, approval context, and payment details are unambiguous.',
            '   - Ask follow-up questions if the money cannot be placed safely.',
            '3. Record finance truth',
            '   - Post the incoming transaction in Finance against the payer account.',
            '   - Preserve the transaction as recorded truth instead of editing it later in place.',
            '4. Apply allocation logic',
            '   - Run Finance allocation logic against the payer obligations and current context.',
            '   - Produce the allocation summary for downstream visibility.',
            '5. Return posting outcome',
            '   - Return the recorded transaction details and the resulting allocation summary.',
            '   - Leave later corrections to a compensating workflow if needed.',
        ],
        preconditions: [
            '- Payer is identified clearly.',
            '- Amount, mode, and received date are known.',
            '- Approval context is complete.',
            '- Allocation context is sufficiently unambiguous for safe posting.',
        ],
        rollback: [
            '- If payment cannot be posted cleanly, abort before recording truth.',
            '- If a mistake is discovered later, correct by compensating workflow, never by editing the original transaction.',
        ],
        scope: [
            '- Scope: incoming tenant or lead collections handled through Finance',
            '- Module owner: Finance',
            '- Version: v1',
            '- Protected default: Yes',
        ],
    },
    finance_record_outgoing_txn: {
        businessOutcome: [
            "Record a real outgoing payment in Finance while placing it under the correct property, vendor, and work context without guesswork.",
        ],
        whenThisRuns: [
            '- Intent run: when CEO or staff needs to record a business outgoing payment.',
            '- Execution happens only when property, payee, amount, and enough work context are available.',
        ],
        whoCanInitiateAndApprove: [
            '- Initiators: CEO, Staff',
            '- Approval: CEO required',
        ],
        detailedFlow: [
            '1. Resolve business payment context',
            '   - Identify property, vendor or payee, amount, payment mode, and date.',
            '   - Determine whether the payment belongs to an existing work context or needs a new one.',
            '2. Validate work placement',
            '   - Check that the outgoing payment can be attached to the correct work or expense context safely.',
            '   - Ask follow-up questions instead of guessing when multiple interpretations are possible.',
            '3. Record finance truth',
            '   - Create the outgoing transaction in Finance with the approved payment details.',
            '   - Preserve the recorded outgoing transaction as immutable money movement truth.',
            '4. Link the internal work structure',
            '   - Reuse or create the internal work context underneath the recorded transaction.',
            '   - Keep vendor linkage, purchases, payments, and settlement trail attached to that work context over time.',
            '5. Return placement outcome',
            '   - Return the recorded outgoing transaction and where it was placed internally.',
            '   - Require compensating workflow if later correction is needed.',
        ],
        preconditions: [
            '- Property is identified.',
            '- Payee or vendor is clear.',
            '- Payment details are complete.',
            '- Work context is clear enough to avoid accidental misplacement.',
        ],
        rollback: [
            '- If context is ambiguous, abort and ask follow-up questions before recording truth.',
            '- Later corrections must be captured as new compensating transactions or workflows.',
        ],
        scope: [
            '- Scope: business outgoing transactions tracked by Finance',
            '- Module owner: Finance',
            '- Version: v1',
            '- Protected default: Yes',
        ],
    },
    finance_record_booking_hold: {
        businessOutcome: [
            "Capture pre-onboarding booking money in Finance, hold it separately from live rent collection, and start the validity window for onboarding completion.",
        ],
        whenThisRuns: [
            '- Intent run: when booking money is received before final onboarding or final unit allocation is completed.',
            '- Execution happens only when payer, amount, and received date are clear.',
        ],
        whoCanInitiateAndApprove: [
            '- Initiators: CEO, Staff',
            '- Approval: CEO required',
        ],
        detailedFlow: [
            '1. Resolve booking hold context',
            '   - Identify the payer, amount received, received date, and optional linked property or unit context.',
            '   - Confirm this money is booking hold money, not normal rent collection.',
            '2. Validate pre-onboarding status',
            '   - Check that onboarding is not already commercially completed for this payment.',
            '   - Keep the booking hold separate from live monthly dues.',
            '3. Record finance truth',
            '   - Record the booking hold amount in Finance against the payer account.',
            '   - Preserve evidence, notes, and payment mode for audit trace.',
            '4. Start the booking window',
            '   - Start the ten-day validity window for onboarding completion.',
            '   - Keep the hold active until onboarding completion or expiry workflow closes it.',
            '5. Return hold outcome',
            '   - Return the active booking hold reference for later onboarding or expiry handling.',
            '   - Do not convert this money into live rent allocation implicitly.',
        ],
        preconditions: [
            '- Payer is known.',
            '- Amount and received date are known.',
            '- Booking hold context is complete.',
            '- The money is being treated as pre-onboarding hold, not active rent collection.',
        ],
        rollback: [
            '- If booking hold context is incomplete, abort before recording.',
            '- Do not auto-convert booking hold money into live rent collection.',
        ],
        scope: [
            '- Scope: pre-onboarding booking hold receipts',
            '- Module owner: Finance',
            '- Version: v1',
            '- Protected default: Yes',
        ],
    },
    finance_expire_booking_hold: {
        businessOutcome: [
            "Close booking holds whose onboarding validity window has ended and mark them commercially forfeited when onboarding did not complete in time.",
        ],
        whenThisRuns: [
            '- Scheduled run: every day at 9:00 PM IST.',
            '- Scope: active booking holds whose validity window may have ended.',
        ],
        whoCanInitiateAndApprove: [
            '- Initiators: CEO, System',
            '- Approval: CEO required',
        ],
        detailedFlow: [
            '1. Review active booking holds',
            '   - Check all booking holds that are still open in Finance.',
            '   - Identify which holds have crossed the ten-day onboarding validity window.',
            '2. Confirm expiry eligibility',
            '   - Ensure the hold is still active and was not already converted into onboarding.',
            '   - Exclude holds that are already closed or not deterministically resolvable.',
            '3. Record finance closure',
            '   - Expire the booking hold in Finance.',
            '   - Mark it forfeited without refund under the booking hold business rule.',
            '4. Return expiry outcome',
            '   - Return which booking hold was closed and its final status.',
            '   - Keep this as auditable finance truth for later review.',
        ],
        preconditions: [
            '- Booking hold exists and is still active.',
            '- The ten-day validity window has been exceeded.',
            '- The hold is deterministically resolvable and not already closed.',
        ],
        rollback: [
            '- If the hold is already closed or cannot be resolved deterministically, abort.',
            '- Do not expire a hold that has already been converted into onboarding.',
        ],
        scope: [
            '- Scope: active booking holds pending expiry check',
            '- Module owner: Finance',
            '- Version: v1',
            '- Protected default: Yes',
        ],
    },
};

const buildDefinitionSections = (workflow) => {
    const preset = WORKFLOW_DEFINITION_PRESETS[workflow?.workflow_family];
    if (preset) {
        return [
            { title: 'Business outcome', lines: preset.businessOutcome },
            { title: 'When this runs', lines: preset.whenThisRuns },
            { title: 'Who can initiate and approve', lines: preset.whoCanInitiateAndApprove },
            { title: 'Detailed flow (what actually happens)', lines: preset.detailedFlow },
            { title: 'Preconditions (must be true before step execution)', lines: preset.preconditions },
            { title: 'Failure and rollback policy', lines: preset.rollback },
            { title: 'Scope and ownership', lines: preset.scope },
        ];
    }

    const schedule = workflow?.schedule || {};
    const approval = workflow?.approval || {};
    const steps = toArray(workflow?.steps);
    const userViewSteps = toArray(workflow?.user_view_steps);
    const runTime = schedule.run_time ? `${schedule.run_time} ${schedule.timezone || ''}`.trim() : 'Not specified';
    const businessOutcome = workflow?.description || 'No description provided.';
    const flowLines = [];
    if (userViewSteps.length > 0) {
        userViewSteps.forEach((line, index) => {
            flowLines.push(`${index + 1}. ${line}`);
        });
    } else {
        steps.forEach((step, index) => {
            flowLines.push(`${index + 1}. ${step?.description || 'No step description'}`);
        });
    }

    return [
        {
            title: 'Business outcome',
            lines: [businessOutcome],
        },
        {
            title: 'When this runs',
            lines: [
                `- Scheduled run: ${schedule.run_rule || 'Not set'} at ${runTime}.`,
                `- Manual run: ${workflow?.trigger_description || 'Not specified.'}`,
            ],
        },
        {
            title: 'Who can initiate and approve',
            lines: [
                `- Initiators: ${toArray(approval.initiators).join(', ') || 'Not specified'}`,
                `- Approval: ${approval.required ? 'Required' : 'Not required'}`,
            ],
        },
        {
            title: 'Detailed flow (what actually happens)',
            lines: flowLines.length > 0 ? flowLines : ['1. No flow steps defined.'],
        },
        {
            title: 'Preconditions (must be true before step execution)',
            lines: [workflow?.confidence?.rule ? `- ${workflow.confidence.rule}` : '- No explicit precondition rule provided.'],
        },
        {
            title: 'Failure and rollback policy',
            lines: [workflow?.rollback_policy?.rule ? `- ${workflow.rollback_policy.rule}` : '- No rollback rule provided.'],
        },
        {
            title: 'Scope and ownership',
            lines: [
                `- Scope: ${schedule.scope || 'Not specified'}`,
                `- Module owner: ${workflow?.module_owner || workflow?.domain || 'Not specified'}`,
                `- Version: ${workflow?.version || 'Not specified'}`,
                `- Protected default: ${workflow?.protected ? 'Yes' : 'No'}`,
            ],
        },
    ];
};

const WorkflowDefinitionViewer = ({
    workflow,
    canManage = false,
    onBack,
    onActivate,
    onDeactivate,
}) => {
    if (!workflow) return null;

    const isTenantEditable = Boolean(workflow.tenant_id) && !workflow.protected;
    const canEnableDisable = canManage && isTenantEditable;
    const sections = buildDefinitionSections(workflow);

    return (
        <div className="flex h-full flex-col bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                {canEnableDisable ? (
                    workflow.is_active ? (
                        <button
                            type="button"
                            onClick={() => onDeactivate?.(workflow.workflow_id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <PowerOff className="h-4 w-4" />
                            Disable
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onActivate?.(workflow.workflow_id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            <Power className="h-4 w-4" />
                            Enable
                        </button>
                    )
                ) : (
                    <span className="text-xs text-gray-500">
                        Edit/clone via MasterAI chat or WhatsApp.
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-4">
                        <div className="text-lg font-semibold text-slate-900">
                            {workflow.name} ({workflow.workflow_id})
                        </div>
                    </div>
                    <div className="space-y-6 px-5 py-5">
                        {sections.map((section) => (
                            <div key={section.title}>
                                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-indigo-700">{section.title}</h3>
                                <div className="space-y-1 text-sm leading-6 text-slate-800">
                                    {section.lines.map((line) => (
                                        <div key={`${section.title}-${line}`}>{line}</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowDefinitionViewer;
