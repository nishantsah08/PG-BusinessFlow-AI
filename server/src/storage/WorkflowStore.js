const fs = require('fs');
const path = require('path');
const { upgradeWorkflowCollection } = require('../workflows/workflowGovernance');

class WorkflowStore {
    constructor(options = {}) {
        this.backend = options.backend || 'local';
        this.filePath = options.filePath || path.join(__dirname, '..', '..', 'data', 'workflows.json');
        this.memoryWorkflows = Array.isArray(options.memoryWorkflows) ? options.memoryWorkflows : [];
    }

    _ensureLocalBackend() {
        if (!['local', 'memory'].includes(this.backend)) {
            throw new Error(`WorkflowStore backend '${this.backend}' is not implemented yet`);
        }
    }

    list() {
        this._ensureLocalBackend();
        if (this.backend === 'memory') {
            const upgraded = upgradeWorkflowCollection(this.memoryWorkflows);
            this.memoryWorkflows = upgraded;
            return [...upgraded];
        }
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            const upgraded = upgradeWorkflowCollection(parsed);
            if (JSON.stringify(parsed) !== JSON.stringify(upgraded)) {
                fs.writeFileSync(this.filePath, JSON.stringify(upgraded, null, 4), 'utf-8');
            }
            return upgraded;
        } catch (_err) {
            return [];
        }
    }

    listForTenant(tenantId = null) {
        const normalizedTenantId = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : null;
        return this.list().filter((workflow) => !workflow?.tenant_id || workflow.tenant_id === normalizedTenantId);
    }

    getById(workflowId) {
        return this.list().find((w) => w.workflow_id === workflowId) || null;
    }

    replace(workflowId, nextWorkflow) {
        const workflows = this.list();
        const index = workflows.findIndex((workflow) => workflow.workflow_id === workflowId);
        if (index === -1) {
            workflows.push(nextWorkflow);
        } else {
            workflows[index] = nextWorkflow;
        }
        this.saveAll(workflows);
        return nextWorkflow;
    }

    saveAll(workflows) {
        this._ensureLocalBackend();
        if (this.backend === 'memory') {
            this.memoryWorkflows = Array.isArray(workflows) ? [...workflows] : [];
            return;
        }
        fs.writeFileSync(this.filePath, JSON.stringify(workflows, null, 4), 'utf-8');
    }
}

module.exports = WorkflowStore;
