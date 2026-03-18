const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

let firestoreClient = null;
let storageClient = null;

function isGcpBackend(backend = '') {
    return String(backend || '').trim().toLowerCase() === 'gcp';
}

function getProjectId() {
    return process.env.GCP_PROJECT_ID
        || process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || undefined;
}

function getFirestore() {
    if (!firestoreClient) {
        const projectId = getProjectId();
        firestoreClient = projectId ? new Firestore({ projectId }) : new Firestore();
    }
    return firestoreClient;
}

function getStorage() {
    if (!storageClient) {
        const projectId = getProjectId();
        storageClient = projectId ? new Storage({ projectId }) : new Storage();
    }
    return storageClient;
}

function getBucketName() {
    const bucketName = String(
        process.env.GCS_BUCKET_NAME
        || process.env.GCP_STORAGE_BUCKET
        || process.env.STORAGE_BUCKET_NAME
        || ''
    ).trim();

    if (!bucketName) {
        throw new Error('GCS_BUCKET_NAME is required when STORAGE_BACKEND=gcp');
    }

    return bucketName;
}

function withCollectionPrefix(name) {
    const prefix = String(process.env.FIRESTORE_COLLECTION_PREFIX || '').trim();
    return prefix ? `${prefix}_${name}` : name;
}

module.exports = {
    isGcpBackend,
    getFirestore,
    getStorage,
    getBucketName,
    withCollectionPrefix,
};
