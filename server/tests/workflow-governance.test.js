const fs = require('fs');
const path = require('path');

const {
    archiveWorkflowVersion,
    buildWorkflowClone,
    discardWorkflowDraft,
    normalizeWorkflowDefinition,
    publishWorkflowVersion,
    resolveEffectiveWorkflow,
} = require('../src/workflows/workflowGovernance');

function loadWorkflow(workflowId) {
    const filePath = path.join(__dirname, '../data/workflows.json');
    const workflows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const workflow = workflows.find((row) => row.workflow_id === workflowId);
    if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found in test fixture.`);
    }
    return {
        workflow: normalizeWorkflowDefinition(workflow, {
            existingWorkflow: workflow,
            existingWorkflows: workflows,
            allowIncomplete: true,
            preserveTimestamps: true,
        }),
        workflows,
    };
}

describe('workflow governance', () => {
    let MasterAI;

    beforeEach(() => {
        jest.resetModules();
        process.env.STORAGE_BACKEND = 'memory';
        process.env.OPENAI_API_KEY = 'test-key';
        MasterAI = require('../src/agents/MasterAI');
    });

    it('rejects invalid finance workflows during definition', async () => {
        const masterAI = new MasterAI([]);
        const result = await masterAI.callTool('define_workflow', {
            workflow_id: 'finance_invalid_manual_v1',
            name: 'Invalid Finance Workflow',
            description: 'Attempts to define a finance mutation workflow without deterministic protection.',
            domain: 'finance',
            trigger_event: 'finance.invalid.requested',
            steps: [
                {
                    step_id: 'finance_invalid_step',
                    description: 'Bad finance step',
                    agent: 'FinanceAI',
                    tool: 'get_financial_summary',
                    params: {},
                    on_failure: 'abort',
                },
            ],
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/deterministic/i);
    });

    it('supports protected template clone and single-active tenant workflow per family', async () => {
        const masterAI = new MasterAI([]);
        const tenantId = 'tenant_workflow_clone';

        const firstClone = await masterAI.callTool('clone_workflow_for_tenant', {
            workflow_id: 'finance_generate_monthly_bills_v1',
            tenant_id: tenantId,
        });
        const secondClone = await masterAI.callTool('clone_workflow_for_tenant', {
            workflow_id: 'finance_generate_monthly_bills_v1',
            tenant_id: tenantId,
        });

        expect(firstClone.success).toBe(true);
        expect(secondClone.success).toBe(true);
        expect(firstClone.workflow.workflow_id).not.toBe(secondClone.workflow.workflow_id);

        const activateFirst = await masterAI.callTool('activate_workflow', {
            workflow_id: firstClone.workflow.workflow_id,
            tenant_id: tenantId,
        });
        expect(activateFirst.success).toBe(true);
        expect(activateFirst.workflow.is_active).toBe(true);

        const activateSecond = await masterAI.callTool('activate_workflow', {
            workflow_id: secondClone.workflow.workflow_id,
            tenant_id: tenantId,
        });
        expect(activateSecond.success).toBe(true);
        expect(activateSecond.workflow.is_active).toBe(true);

        const visible = masterAI._getTenantVisibleWorkflows(tenantId)
            .filter((workflow) => workflow.workflow_family === 'finance_generate_monthly_bills');
        const activeTenantClones = visible.filter((workflow) => workflow.tenant_id === tenantId && workflow.is_active);
        expect(activeTenantClones).toHaveLength(1);
        expect(activeTenantClones[0].workflow_id).toBe(secondClone.workflow.workflow_id);

        const effective = masterAI._resolveFinanceWorkflow('generate_monthly_bills', tenantId);
        expect(effective.workflow_id).toBe(secondClone.workflow.workflow_id);

        const deactivated = await masterAI.callTool('deactivate_workflow', {
            workflow_id: secondClone.workflow.workflow_id,
            tenant_id: tenantId,
        });
        expect(deactivated.success).toBe(true);
        expect(deactivated.workflow.is_active).toBe(false);

        const fallback = masterAI._resolveFinanceWorkflow('generate_monthly_bills', tenantId);
        expect(fallback.workflow_id).toBe('finance_generate_monthly_bills_v1');
    });

    it('supports draft publish and archive in the new lifecycle model', () => {
        const { workflow: template, workflows: seed } = loadWorkflow('finance_record_booking_hold_v1');

        const draft = buildWorkflowClone(template, { tenant_id: 'tenant_sop_lifecycle' });
        const withDraft = [...seed, draft];

        const publishedResult = publishWorkflowVersion(withDraft, draft.workflow_id, 'tenant_sop_lifecycle');
        expect(publishedResult.workflow.version_type).toBe('tenant_published');
        expect(publishedResult.workflow.is_active).toBe(true);

        const archivedResult = archiveWorkflowVersion(publishedResult.workflows, draft.workflow_id, 'tenant_sop_lifecycle');
        expect(archivedResult.workflow.version_type).toBe('archived_snapshot');
        expect(archivedResult.workflow.is_active).toBe(false);
    });

    it('archives the previous published version when a newer tenant draft is published', () => {
        const { workflow: template, workflows: seed } = loadWorkflow('finance_generate_monthly_bills_v1');

        const firstDraft = buildWorkflowClone(template, {
            tenant_id: 'tenant_publish_replace',
            workflow_id: 'finance_generate_monthly_bills_tenant_publish_replace_draft_1',
        });
        const secondDraft = buildWorkflowClone(template, {
            tenant_id: 'tenant_publish_replace',
            workflow_id: 'finance_generate_monthly_bills_tenant_publish_replace_draft_2',
        });

        const firstPublish = publishWorkflowVersion([...seed, firstDraft], firstDraft.workflow_id, 'tenant_publish_replace');
        const secondPublish = publishWorkflowVersion([...firstPublish.workflows, secondDraft], secondDraft.workflow_id, 'tenant_publish_replace');

        const firstPublishedRow = secondPublish.workflows.find((workflow) => workflow.workflow_id === firstDraft.workflow_id);
        const secondPublishedRow = secondPublish.workflows.find((workflow) => workflow.workflow_id === secondDraft.workflow_id);
        const effective = resolveEffectiveWorkflow(secondPublish.workflows, template.workflow_family, 'tenant_publish_replace');

        expect(firstPublishedRow.version_type).toBe('archived_snapshot');
        expect(firstPublishedRow.replaced_workflow_id).toBe(secondDraft.workflow_id);
        expect(secondPublishedRow.version_type).toBe('tenant_published');
        expect(effective.workflow_id).toBe(secondDraft.workflow_id);
    });

    it('allows only drafts to be discarded', () => {
        const { workflow: template, workflows: seed } = loadWorkflow('finance_generate_monthly_bills_v1');
        const draft = buildWorkflowClone(template, { tenant_id: 'tenant_discard_rule' });

        const discarded = discardWorkflowDraft([...seed, draft], draft.workflow_id, 'tenant_discard_rule');
        expect(discarded.workflow.workflow_id).toBe(draft.workflow_id);

        const published = publishWorkflowVersion([...seed, draft], draft.workflow_id, 'tenant_discard_rule');
        expect(() => discardWorkflowDraft(published.workflows, draft.workflow_id, 'tenant_discard_rule')).toThrow(/only tenant drafts/i);
    });
});
