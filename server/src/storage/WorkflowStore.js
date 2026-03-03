const fs = require('fs');
const path = require('path');

class WorkflowStore {
    constructor(options = {}) {
        this.backend = options.backend || 'local';
        this.filePath = options.filePath || path.join(__dirname, '..', '..', 'data', 'workflows.json');
    }

    _ensureLocalBackend() {
        if (this.backend !== 'local') {
            throw new Error(`WorkflowStore backend '${this.backend}' is not implemented yet`);
        }
    }

    list() {
        this._ensureLocalBackend();
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            return JSON.parse(raw);
        } catch (_err) {
            return [];
        }
    }

    getById(workflowId) {
        return this.list().find((w) => w.workflow_id === workflowId) || null;
    }

    saveAll(workflows) {
        this._ensureLocalBackend();
        fs.writeFileSync(this.filePath, JSON.stringify(workflows, null, 4), 'utf-8');
    }
}

module.exports = WorkflowStore;
