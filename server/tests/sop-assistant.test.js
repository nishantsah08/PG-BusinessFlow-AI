const fs = require('fs');
const path = require('path');

const { proposeSopAssistantReply, applySopPatch } = require('../src/workflows/sopAssistant');
const {
    buildBlankWorkflowDraft,
    buildWorkflowClone,
    normalizeWorkflowDefinition,
    validateWorkflowDefinition,
} = require('../src/workflows/workflowGovernance');

function loadWorkflow(workflowId) {
    const filePath = path.join(__dirname, '../data/workflows.json');
    const workflows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const workflow = workflows.find((row) => row.workflow_id === workflowId);
    if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found in test fixture.`);
    }
    return normalizeWorkflowDefinition(workflow, {
        existingWorkflow: workflow,
        existingWorkflows: workflows,
        allowIncomplete: true,
        preserveTimestamps: true,
    });
}

describe('SOP assistant', () => {
    it('greets on an active SOP without proposing a change', () => {
        const workflow = loadWorkflow('finance_record_booking_hold_v1');
        const result = proposeSopAssistantReply(workflow, 'hi');

        expect(result.assistant_message).toMatch(/this sop is active/i);
        expect(result.proposal).toBeNull();
    });

    it('explains the selected SOP without returning a patch', () => {
        const workflow = loadWorkflow('finance_generate_monthly_bills_v1');
        const result = proposeSopAssistantReply(workflow, 'Explain this SOP');

        expect(result.assistant_message).toContain(workflow.description);
        expect(result.proposal).toBeNull();
    });

    it('creates the first draft for a blank new SOP', () => {
        const blankDraft = buildBlankWorkflowDraft({
            tenant_id: 'tenant_sop_assistant',
            workflow_family: 'draft_new_sop',
        });

        const result = proposeSopAssistantReply(blankDraft, 'Create a finance vendor settlement SOP', {
            system_context: {
                property: { property_count: 3, unit_count: 42 },
                hr: { staff_count: 12 },
                finance: { vendor_count: 7 },
                visible_sops: { counts: { active: 5 } },
            },
        });

        expect(result.assistant_message).toMatch(/first sop draft/i);
        expect(result.proposal?.preview).toContain('Finance Vendor Settlement SOP');
        expect(result.proposal?.patch?.name).toBe('Finance Vendor Settlement SOP');
        expect(result.proposal?.patch?.sop_document?.sections?.find((section) => section.key === 'business_outcome')?.content).toBeTruthy();
        expect(result.proposal?.patch?.sop_document?.sections?.find((section) => section.key === 'scope_and_ownership')?.content).toContain('3 properties');
        expect(result.proposal?.patch?.sop_document?.sections?.find((section) => section.key === 'scope_and_ownership')?.content).toContain('42 units');
    });

    it('tells the user when the booking-hold SOP already contains receipt-proof guidance', () => {
        const workflow = loadWorkflow('finance_record_booking_hold_v1');
        const result = proposeSopAssistantReply(workflow, 'Add receipt proof check before finance posting');

        expect(result.assistant_message).toMatch(/already present/i);
        expect(result.proposal).toBeNull();
    });

    it('prepares a clarification proposal that stays publishable after apply', () => {
        const workflow = loadWorkflow('finance_generate_monthly_bills_v1');
        const draft = buildWorkflowClone(workflow, { tenant_id: 'tenant_sop_assistant' });
        const result = proposeSopAssistantReply(draft, 'Clarify the business handoff');

        expect(result.proposal?.preview).toMatch(/clarify/i);

        const updated = applySopPatch(draft, result.proposal.patch);
        const flowSection = updated.sop_document.sections.find((section) => section.key === 'detailed_flow');
        const validation = validateWorkflowDefinition(updated, {
            existingWorkflows: [],
            isUpdate: true,
            existingWorkflowId: updated.workflow_id,
            mode: 'publish',
        });

        expect(flowSection?.content).toMatch(/follow-up deadline/i);
        expect(validation.ok).toBe(true);
    });

    it('shows rollback removal as a proposal and finance validation rejects it after apply', () => {
        const workflow = loadWorkflow('finance_record_incoming_txn_v1');
        const draft = buildWorkflowClone(workflow, { tenant_id: 'tenant_sop_assistant' });
        const result = proposeSopAssistantReply(draft, 'Remove rollback requirement');

        expect(result.proposal?.preview).toMatch(/remove the failure and rollback rule/i);

        const updated = applySopPatch(draft, result.proposal.patch);
        const validation = validateWorkflowDefinition(updated, {
            existingWorkflows: [],
            isUpdate: true,
            existingWorkflowId: updated.workflow_id,
            mode: 'publish',
        });

        expect(updated.rollback_policy.rule).toBe('');
        expect(validation.ok).toBe(false);
        expect(validation.errors.join(' ')).toMatch(/rollback/i);
    });

    it('shows approval removal as a proposal and finance validation rejects it after apply', () => {
        const workflow = loadWorkflow('finance_generate_monthly_bills_v1');
        const draft = buildWorkflowClone(workflow, { tenant_id: 'tenant_sop_assistant' });
        const result = proposeSopAssistantReply(draft, 'Remove approval');

        expect(result.proposal?.preview).toMatch(/remove approval/i);

        const updated = applySopPatch(draft, result.proposal.patch);
        const validation = validateWorkflowDefinition(updated, {
            existingWorkflows: [],
            isUpdate: true,
            existingWorkflowId: updated.workflow_id,
            mode: 'publish',
        });

        expect(updated.approval.required).toBe(false);
        expect(validation.ok).toBe(false);
        expect(validation.errors.join(' ')).toMatch(/approval/i);
    });
});
