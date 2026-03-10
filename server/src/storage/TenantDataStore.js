const fs = require('fs');
const path = require('path');

class TenantDataStore {
    constructor(options = {}) {
        this.tenantId = options.tenantId || 'default';
        this.namespace = options.namespace;
        this.backend = options.backend || 'local';
        this.baseDir = options.baseDir || path.join(__dirname, '..', '..', 'data', 'tenants');
    }

    _ensureLocalBackend() {
        if (this.backend !== 'local') {
            return;
        }
    }

    _getFilePath() {
        return path.join(this.baseDir, this.tenantId, `${this.namespace}.json`);
    }

    load(defaultValue = {}) {
        const resolved = this._clone(defaultValue);
        if (this.backend !== 'local') {
            return resolved;
        }

        try {
            const filePath = this._getFilePath();
            if (!fs.existsSync(filePath)) {
                return resolved;
            }
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return resolved;
            }
            return parsed;
        } catch (_error) {
            return resolved;
        }
    }

    save(data) {
        if (this.backend !== 'local') {
            return;
        }

        const filePath = this._getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    }

    _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}

module.exports = TenantDataStore;
