const fs = require('fs');
const path = require('path');

class ImageStore {
    constructor(options = {}) {
        this.backend = options.backend || 'local';
        this.imageDir = options.imageDir || path.join(__dirname, '..', '..', '..', 'images');
        if (this.backend === 'local' && !fs.existsSync(this.imageDir)) {
            fs.mkdirSync(this.imageDir, { recursive: true });
        }
    }

    _ensureLocalBackend() {
        if (this.backend !== 'local') {
            throw new Error(`ImageStore backend '${this.backend}' is not implemented yet`);
        }
    }

    saveBuffer(buffer, originalName, prefix = 'img') {
        this._ensureLocalBackend();
        const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        fs.writeFileSync(path.join(this.imageDir, filename), buffer);
        return `/images/${filename}`;
    }
}

module.exports = ImageStore;
