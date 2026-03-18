const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'fir-bestpg';
const collectionPrefix = process.env.FIRESTORE_COLLECTION_PREFIX || 'preprod';
const bucketName = process.env.GCS_BUCKET_NAME || 'pg-businessflow-uploads';
const confirmationToken = 'RESET_PREPROD_FROM_SCRATCH';
const args = new Set(process.argv.slice(2));
const helpRequested = args.has('--help') || args.has('-h');
const force = args.has('--force');

const firestore = new Firestore({ projectId });
const storage = new Storage({ projectId });

const tenantConfigsCollection = firestore.collection(`${collectionPrefix}_tenant_configs`);
const tenantRootCollection = firestore.collection(`${collectionPrefix}_tenants`);
const appStateCollection = firestore.collection(`${collectionPrefix}_app_state`);

const storagePrefixes = ['prop/', 'artifact/', 'chat_upload/', 'smoke-tests/'];

async function listTenantConfigDocs() {
    const snapshot = await tenantConfigsCollection.get();
    return snapshot.docs;
}

async function ensureConfirmed() {
    if (force || process.env.RESET_PREPROD_CONFIRM === confirmationToken) {
        return;
    }
    throw new Error(
        `Reset blocked. Re-run with --force or set RESET_PREPROD_CONFIRM=${confirmationToken}. `
        + 'This script permanently clears application-owned preprod state.'
    );
}

function printUsage() {
    console.log([
        'Usage:',
        '  node scripts/reset_preprod_state.js --force',
        '',
        'Behavior:',
        '  - Clears application-owned preprod tenant data in Firestore',
        '  - Removes non-default tenant configs',
        '  - Blanks the default tenant owner state',
        '  - Removes tenant-scoped workflow variants',
        '  - Deletes uploaded preprod objects under prop/, artifact/, chat_upload/, and smoke-tests/',
        '  - Does NOT delete Firebase Auth users because Auth is shared at the project level',
    ].join('\n'));
}

function buildBlankDefaultConfig(existing = {}) {
    const basePersona = existing.persona && typeof existing.persona === 'object' ? existing.persona : {};
    return {
        tenant_id: 'default',
        business_name: existing.business_name || 'PG-BusinessFlow.ai',
        property: existing.property || undefined,
        rates: existing.rates || undefined,
        finance: existing.finance || undefined,
        account_status: 'ACTIVE',
        persona: {
            ...basePersona,
            name: null,
            ceo_email: null,
            ceo_phone: null,
            ceo_phone_verified_at: null,
            role: basePersona.role || 'CEO',
            session_timeout_ms: basePersona.session_timeout_ms || 15 * 60 * 1000,
        },
    };
}

async function deleteDocTree(docRef) {
    const summary = {
        docPath: docRef.path,
        deletedDocs: 0,
    };
    const subcollections = await docRef.listCollections();
    for (const subcollection of subcollections) {
        const snapshot = await subcollection.get();
        for (const childDoc of snapshot.docs) {
            const childSummary = await deleteDocTree(childDoc.ref);
            summary.deletedDocs += childSummary.deletedDocs;
        }
    }
    await docRef.delete().catch(() => {});
    summary.deletedDocs += 1;
    return summary;
}

async function deleteTenantTree(tenantId) {
    const rootRef = tenantRootCollection.doc(tenantId);
    const deletedNamespaces = [];
    const namespacesCollection = rootRef.collection('namespaces');
    const namespaceSnapshot = await namespacesCollection.get();
    for (const namespaceDoc of namespaceSnapshot.docs) {
        const namespaceSummary = await deleteDocTree(namespaceDoc.ref);
        deletedNamespaces.push({
            namespace: namespaceDoc.id,
            deletedDocs: namespaceSummary.deletedDocs,
        });
    }
    await rootRef.delete().catch(() => {});
    return deletedNamespaces;
}

async function resetWorkflowState() {
    const workflowRef = appStateCollection.doc('workflows');
    const workflowDoc = await workflowRef.get();
    const existing = Array.isArray(workflowDoc.data()?.workflows) ? workflowDoc.data().workflows : [];
    const preserved = existing.filter((workflow) => !workflow?.tenant_id);
    const removed = existing.filter((workflow) => workflow?.tenant_id);
    await workflowRef.set({ workflows: preserved }, { merge: false });
    return {
        preservedSystemWorkflowCount: preserved.length,
        removedTenantWorkflowCount: removed.length,
        removedTenantIds: Array.from(new Set(removed.map((workflow) => workflow.tenant_id).filter(Boolean))).sort(),
    };
}

async function deleteExtraAppStateDocs() {
    const snapshot = await appStateCollection.get();
    const deleted = [];
    for (const doc of snapshot.docs) {
        if (doc.id === 'workflows') continue;
        const summary = await deleteDocTree(doc.ref);
        deleted.push(summary);
    }
    return deleted;
}

async function deleteStorageObjects() {
    const bucket = storage.bucket(bucketName);
    const deleted = [];
    for (const prefix of storagePrefixes) {
        const [files] = await bucket.getFiles({ prefix });
        if (files.length === 0) continue;
        await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
        deleted.push(...files.map((file) => file.name));
    }
    return deleted;
}

async function main() {
    if (helpRequested) {
        printUsage();
        return;
    }
    await ensureConfirmed();

    const configDocs = await listTenantConfigDocs();
    const existingDefault = configDocs.find((doc) => doc.id === 'default')?.data() || {};
    const tenantIds = new Set(['default', ...configDocs.map((doc) => doc.id)]);

    const deletedNamespaces = {};
    for (const tenantId of tenantIds) {
        deletedNamespaces[tenantId] = await deleteTenantTree(tenantId);
    }

    const deletedTenantConfigs = [];
    for (const doc of configDocs) {
        if (doc.id === 'default') continue;
        await doc.ref.delete();
        deletedTenantConfigs.push(doc.id);
    }

    await tenantConfigsCollection.doc('default').set(buildBlankDefaultConfig(existingDefault), { merge: false });

    const workflowReset = await resetWorkflowState();
    const deletedAppStateDocs = await deleteExtraAppStateDocs();
    const deletedObjects = await deleteStorageObjects();

    console.log(JSON.stringify({
        projectId,
        collectionPrefix,
        bucketName,
        firebaseAuthReset: false,
        firebaseAuthResetReason: 'Skipped intentionally because Firebase Auth is shared at the project level.',
        reset: {
            defaultTenantConfig: 'blank-restored',
            deletedTenantConfigs,
            deletedNamespaces,
            deletedExtraAppStateDocs: deletedAppStateDocs,
            workflowReset,
            deletedObjectsCount: deletedObjects.length,
            deletedObjects,
        },
    }, null, 2));
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
