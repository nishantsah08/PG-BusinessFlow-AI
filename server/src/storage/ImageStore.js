const fs = require('fs');
const path = require('path');
const { isGcpBackend, getStorage, getBucketName } = require('./GcpResourceClient');

class ImageStore {
    constructor(options = {}) {
        this.backend = options.backend || 'local';
        this.imageDir = options.imageDir || path.join(__dirname, '..', '..', '..', 'images');
        this.publicBaseUrl = String(options.publicBaseUrl || '').replace(/\/+$/, '');
        if (this.backend === 'local' && !fs.existsSync(this.imageDir)) {
            fs.mkdirSync(this.imageDir, { recursive: true });
        }
    }

    _ensureLocalBackend() {
        if (!['local', 'gcp'].includes(this.backend)) {
            throw new Error(`ImageStore backend '${this.backend}' is not implemented yet`);
        }
    }

    _buildObjectPath(prefix, originalName) {
        const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
        return `${prefix}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    }

    _buildPublicUrl(objectPath) {
        return `${this.publicBaseUrl}/api/storage/file?path=${encodeURIComponent(objectPath)}`;
    }

    _inferContentType(ext) {
        switch (String(ext || '').toLowerCase()) {
            case 'png':
                return 'image/png';
            case 'gif':
                return 'image/gif';
            case 'webp':
                return 'image/webp';
            case 'pdf':
                return 'application/pdf';
            case 'jpeg':
            case 'jpg':
            default:
                return 'image/jpeg';
        }
    }

    async saveBuffer(buffer, originalName, prefix = 'img') {
        this._ensureLocalBackend();
        const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        if (isGcpBackend(this.backend)) {
            if (!this.publicBaseUrl) {
                throw new Error('BACKEND_PUBLIC_BASE_URL is required when STORAGE_BACKEND=gcp');
            }
            const objectPath = this._buildObjectPath(prefix, originalName);
            const bucket = getStorage().bucket(getBucketName());
            await bucket.file(objectPath).save(buffer, {
                resumable: false,
                metadata: {
                    contentType: this._inferContentType(ext),
                },
            });
            return this._buildPublicUrl(objectPath);
        }
        fs.writeFileSync(path.join(this.imageDir, filename), buffer);
        return `/images/${filename}`;
    }

    async readFile(objectPath) {
        this._ensureLocalBackend();
        if (!isGcpBackend(this.backend)) {
            throw new Error('readFile is only supported for gcp image storage');
        }
        const bucket = getStorage().bucket(getBucketName());
        const file = bucket.file(objectPath);
        const [exists] = await file.exists();
        if (!exists) {
            return null;
        }
        const [buffer] = await file.download();
        const [metadata] = await file.getMetadata();
        return {
            buffer,
            contentType: metadata?.contentType || 'application/octet-stream',
            cacheControl: metadata?.cacheControl || 'public, max-age=300',
        };
    }
}

module.exports = ImageStore;
