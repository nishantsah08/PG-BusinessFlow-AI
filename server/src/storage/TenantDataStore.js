const fs = require('fs');
const path = require('path');
const { isGcpBackend, getFirestore, withCollectionPrefix } = require('./GcpResourceClient');

class TenantDataStore {
    constructor(options = {}) {
        this.tenantId = options.tenantId || 'default';
        this.namespace = options.namespace;
        this.backend = options.backend || 'local';
        this.baseDir = options.baseDir || path.join(__dirname, '..', '..', 'data', 'tenants');
        this.cache = undefined;
        this.hydrated = false;
        this.persistQueue = Promise.resolve();
    }

    _ensureLocalBackend() {
        if (this.backend !== 'local') {
            return;
        }
    }

    _getFilePath() {
        return path.join(this.baseDir, this.tenantId, `${this.namespace}.json`);
    }

    _getDocRef() {
        return getFirestore()
            .collection(withCollectionPrefix('tenants'))
            .doc(this.tenantId)
            .collection('namespaces')
            .doc(this.namespace);
    }

    async hydrate(defaultValue = {}) {
        const resolved = this._clone(defaultValue);
        if (this.hydrated) {
            return this._clone(this.cache !== undefined ? this.cache : resolved);
        }

        if (!isGcpBackend(this.backend)) {
            this.cache = this.load(resolved);
            this.hydrated = true;
            return this._clone(this.cache);
        }

        try {
            const snapshot = await this._getDocRef().get();
            this.cache = snapshot.exists && snapshot.data() && typeof snapshot.data() === 'object'
                ? snapshot.data()
                : resolved;
        } catch (_error) {
            this.cache = resolved;
        }

        this.hydrated = true;
        return this._clone(this.cache);
    }

    load(defaultValue = {}) {
        const resolved = this._clone(defaultValue);
        if (this.hydrated) {
            return this._clone(this.cache !== undefined ? this.cache : resolved);
        }

        if (isGcpBackend(this.backend)) {
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
            this.cache = parsed;
            this.hydrated = true;
            return parsed;
        } catch (_error) {
            return resolved;
        }
    }

    async save(data) {
        const snapshot = this._clone(data);
        this.cache = snapshot;
        this.hydrated = true;

        if (isGcpBackend(this.backend)) {
            this.persistQueue = this.persistQueue
                .then(() => this._getDocRef().set(this._clone(snapshot), { merge: false }))
                .catch((error) => {
                    console.error(`[TenantDataStore] Failed to persist ${this.tenantId}/${this.namespace}:`, error?.message || error);
                });
            await this.persistQueue;
            return;
        }

        const filePath = this._getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 4), 'utf8');
    }

    _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}

module.exports = TenantDataStore;
