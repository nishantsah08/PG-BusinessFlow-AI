const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const TenantDataStore = require('../src/storage/TenantDataStore');

const backendUrl = process.env.BACKEND_URL || 'https://pgbf-backend-development-57ju5cwl3a-el.a.run.app';
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'fir-bestpg';
const collectionPrefix = process.env.FIRESTORE_COLLECTION_PREFIX || 'preprod';
const bucketName = process.env.GCS_BUCKET_NAME || 'pg-businessflow-uploads';

async function expectJson(url) {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(`${url} failed with ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload;
}

async function main() {
    const firestore = new Firestore({ projectId });
    const storage = new Storage({ projectId });
    const bucket = storage.bucket(bucketName);

    const health = await expectJson(`${backendUrl}/health`);
    const ready = await expectJson(`${backendUrl}/ready`);

    const tenantConfig = await firestore.collection(`${collectionPrefix}_tenant_configs`).doc('default').get();
    if (!tenantConfig.exists) {
        throw new Error(`Missing Firestore doc: ${collectionPrefix}_tenant_configs/default`);
    }

    const namespace = `smoke_seq_${Date.now()}`;
    const smokeStore = new TenantDataStore({
        tenantId: 'default',
        namespace,
        backend: 'gcp',
    });
    const smokePayload = {
        marker: `seq-${Date.now()}`,
        values: ['alpha', 'beta'],
    };
    await smokeStore.save(smokePayload);
    const reloadedPayload = await new TenantDataStore({
        tenantId: 'default',
        namespace,
        backend: 'gcp',
    }).hydrate({});
    await firestore
        .collection(`${collectionPrefix}_tenants`)
        .doc('default')
        .collection('namespaces')
        .doc(namespace)
        .delete()
        .catch(() => {});

    if (reloadedPayload.marker !== smokePayload.marker || reloadedPayload.values?.length !== 2) {
        throw new Error('TenantDataStore sequential save/read mismatch.');
    }

    const smokeObjectPath = `smoke-tests/${Date.now()}-gcp-linkage.txt`;
    const smokeFile = bucket.file(smokeObjectPath);
    await smokeFile.save(Buffer.from('gcp linkage smoke ok', 'utf8'), {
        resumable: false,
        metadata: { contentType: 'text/plain' },
    });
    const [downloaded] = await smokeFile.download();
    await smokeFile.delete({ ignoreNotFound: true });

    if (downloaded.toString('utf8') !== 'gcp linkage smoke ok') {
        throw new Error('GCS round-trip content mismatch.');
    }

    console.log(JSON.stringify({
        backendUrl,
        health,
        ready,
        firestore: {
            tenantConfigExists: tenantConfig.exists,
            persona: tenantConfig.data()?.persona || null,
            tenantDataStoreRoundTrip: 'ok',
        },
        gcs: {
            bucketName,
            roundTrip: 'ok',
        },
    }, null, 2));
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
