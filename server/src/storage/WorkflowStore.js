const fs = require('fs');
const path = require('path');
const { upgradeWorkflowCollection } = require('../workflows/workflowGovernance');
const { isGcpBackend, getFirestore, withCollectionPrefix } = require('./GcpResourceClient');

class WorkflowStore {
    constructor(options = {}) {
        this.backend = options.backend || 'local';
        this.filePath = options.filePath || path.join(__dirname, '..', '..', 'data', 'workflows.json');
        this.memoryWorkflows = Array.isArray(options.memoryWorkflows) ? options.memoryWorkflows : [];
        this.cachedWorkflows = null;
        this.hydrated = false;
        this.persistQueue = Promise.resolve();
    }

    _ensureLocalBackend() {
        if (!['local', 'memory', 'gcp'].includes(this.backend)) {
            throw new Error(`WorkflowStore backend '${this.backend}' is not implemented yet`);
        }
    }

    _getDocRef() {
        return getFirestore().collection(withCollectionPrefix('app_state')).doc('workflows');
    }

    async initialize() {
        this._ensureLocalBackend();
        if (this.hydrated) return;

        if (this.backend === 'memory') {
            const upgraded = upgradeWorkflowCollection(this.memoryWorkflows);
            this.memoryWorkflows = upgraded;
            this.cachedWorkflows = [...upgraded];
            this.hydrated = true;
            return;
        }

        if (isGcpBackend(this.backend)) {
            try {
                const snapshot = await this._getDocRef().get();
                const raw = snapshot.exists ? snapshot.data()?.workflows : [];
                this.cachedWorkflows = upgradeWorkflowCollection(Array.isArray(raw) ? raw : []);
            } catch (_error) {
                this.cachedWorkflows = [];
            }
            this.hydrated = true;
            return;
        }

        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            const upgraded = upgradeWorkflowCollection(parsed);
            if (JSON.stringify(parsed) !== JSON.stringify(upgraded)) {
                fs.writeFileSync(this.filePath, JSON.stringify(upgraded, null, 4), 'utf-8');
            }
            this.cachedWorkflows = upgraded;
        } catch (_err) {
            this.cachedWorkflows = [];
        }
        this.hydrated = true;
    }

    list() {
        this._ensureLocalBackend();
        if (this.backend === 'memory') {
            const upgraded = upgradeWorkflowCollection(this.memoryWorkflows);
            this.memoryWorkflows = upgraded;
            return [...upgraded];
        }
        if (this.hydrated && Array.isArray(this.cachedWorkflows)) {
            return [...this.cachedWorkflows];
        }
        if (isGcpBackend(this.backend)) {
            return [];
        }
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            const upgraded = upgradeWorkflowCollection(parsed);
            if (JSON.stringify(parsed) !== JSON.stringify(upgraded)) {
                fs.writeFileSync(this.filePath, JSON.stringify(upgraded, null, 4), 'utf-8');
            }
            this.cachedWorkflows = upgraded;
            this.hydrated = true;
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

    async replace(workflowId, nextWorkflow) {
        const workflows = this.list();
        const index = workflows.findIndex((workflow) => workflow.workflow_id === workflowId);
        if (index === -1) {
            workflows.push(nextWorkflow);
        } else {
            workflows[index] = nextWorkflow;
        }
        await this.saveAll(workflows);
        return nextWorkflow;
    }

    async saveAll(workflows) {
        this._ensureLocalBackend();
        const snapshot = Array.isArray(workflows) ? [...workflows] : [];
        this.cachedWorkflows = snapshot;
        this.hydrated = true;
        if (this.backend === 'memory') {
            this.memoryWorkflows = snapshot;
            return;
        }
        if (isGcpBackend(this.backend)) {
            this.persistQueue = this.persistQueue
                .then(() => this._getDocRef().set({ workflows: snapshot }, { merge: false }))
                .catch((error) => {
                    console.error('[WorkflowStore] Failed to persist workflows:', error?.message || error);
                });
            await this.persistQueue;
            return;
        }
        fs.writeFileSync(this.filePath, JSON.stringify(snapshot, null, 4), 'utf-8');
    }
}

module.exports = WorkflowStore;
