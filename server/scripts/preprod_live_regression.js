const fs = require('fs');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const backendUrl = process.env.BACKEND_URL || 'https://pgbf-backend-development-57ju5cwl3a-el.a.run.app';
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'fir-bestpg';
const collectionPrefix = process.env.FIRESTORE_COLLECTION_PREFIX || 'preprod';
const bucketName = process.env.GCS_BUCKET_NAME || 'pg-businessflow-uploads';
const actorEmail = process.env.BYPASS_EMAIL || '';
const tenantId = process.env.TEST_TENANT_ID || 'default';
const authBearer = process.env.AUTH_BEARER || '';
const imagePath = process.env.TEST_IMAGE_PATH || path.join(__dirname, '..', '..', 'images', 'chat_upload_1772530892069_gbgmxt.jpg');

if (!actorEmail && !authBearer) {
    throw new Error('Provide BYPASS_EMAIL or AUTH_BEARER to run preprod live regression.');
}

const firestore = new Firestore({ projectId });
const storage = new Storage({ projectId });

const tenantRootCollection = firestore.collection(`${collectionPrefix}_tenants`);
const namespacesCollection = tenantRootCollection.doc(tenantId).collection('namespaces');
const namespacesToSnapshot = ['crm', 'hr', 'property', 'finance'];

function baseHeaders(extra = {}) {
    const headers = { ...extra, 'X-Tenant-ID': tenantId };
    if (authBearer) {
        headers.Authorization = `Bearer ${authBearer}`;
    }
    if (actorEmail) {
        headers['X-Actor-Email'] = actorEmail.toLowerCase();
    }
    return headers;
}

async function expectJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        throw new Error(`${options.method || 'GET'} ${url} failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload;
}

function parseStoragePathFromUrl(url) {
    const parsed = new URL(String(url));
    return parsed.searchParams.get('path');
}

async function snapshotNamespaces() {
    const snapshot = {};
    for (const namespace of namespacesToSnapshot) {
        const doc = await namespacesCollection.doc(namespace).get();
        snapshot[namespace] = doc.exists ? doc.data() : null;
    }
    return snapshot;
}

async function restoreNamespaces(snapshot) {
    for (const namespace of namespacesToSnapshot) {
        const ref = namespacesCollection.doc(namespace);
        const previous = snapshot[namespace];
        if (previous && typeof previous === 'object') {
            await ref.set(previous, { merge: false });
        } else {
            await ref.delete().catch(() => {});
        }
    }
}

async function deleteUploadedObjects(objectPaths) {
    const uniquePaths = [...new Set(objectPaths.filter(Boolean))];
    if (uniquePaths.length === 0) return;
    const bucket = storage.bucket(bucketName);
    await Promise.all(uniquePaths.map((objectPath) => bucket.file(objectPath).delete({ ignoreNotFound: true })));
}

async function uploadForm(endpoint, fieldName, filename, buffer, contentType) {
    const form = new FormData();
    form.append(fieldName, new Blob([buffer], { type: contentType }), filename);
    return expectJson(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: baseHeaders(),
        body: form,
    });
}

async function main() {
    const imageBuffer = fs.readFileSync(imagePath);
    const artifactBuffer = Buffer.from(`preprod regression artifact ${Date.now()}\n`, 'utf8');
    const unique = Date.now();
    const uploadedObjects = [];
    const snapshot = await snapshotNamespaces();

    try {
        const authContext = await expectJson(`${backendUrl}/api/auth/context`, {
            headers: baseHeaders(),
        });
        if (authContext?.data?.tenant_id !== tenantId) {
            throw new Error(`Resolved tenant mismatch. Expected ${tenantId}, got ${authContext?.data?.tenant_id || 'unknown'}.`);
        }

        const leadEmail = `regression-lead-${unique}@example.com`;
        const leadPhone = `+9199${String(unique).slice(-8)}`;
        const staffEmail = `regression-staff-${unique}@example.com`;
        const staffPhone = `+9188${String(unique).slice(-8)}`;
        const propertyName = `Regression Property ${unique}`;
        const vendorName = `Regression Vendor ${unique}`;

        const crmAdd = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'CRMAgent',
                tool_name: 'add_lead',
                parameters: {
                    name: 'Regression Lead',
                    primary_phone: leadPhone,
                    email: leadEmail,
                    profile_type: 'Customer',
                },
            }),
        });

        const crmLookup = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'CRMAgent',
                tool_name: 'get_lead_by_email',
                parameters: { email: leadEmail },
            }),
        });

        const propertyAdd = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'PropertyAI',
                tool_name: 'add_property',
                parameters: {
                    name: propertyName,
                    address: 'Kharadi, Pune, Maharashtra 411014',
                    street_address: 'Kharadi, Pune, Maharashtra 411014',
                    pin_code: '411014',
                    area: 'Kharadi',
                    city: 'Pune',
                    state: 'Maharashtra',
                    description: 'Regression test property',
                    amenities: ['WiFi', 'Laundry'],
                    floors: 2,
                },
            }),
        });
        const propertyId = propertyAdd.data?.property_id || propertyAdd.data?.property?.id;
        if (!propertyId) {
            throw new Error(`Property creation did not return property_id: ${JSON.stringify(propertyAdd)}`);
        }

        const unitAdd = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'PropertyAI',
                tool_name: 'add_unit',
                parameters: {
                    property_id: propertyId,
                    unit_number: `RG-${String(unique).slice(-4)}`,
                    floor: 1,
                    types: ['Single Sharing'],
                    amenities: ['WiFi'],
                    base_rent: 12500,
                },
            }),
        });

        const imageUpload = await uploadForm('/api/upload/images', 'images', 'regression.jpg', imageBuffer, 'image/jpeg');
        const imageUrl = imageUpload.data?.urls?.[0];
        uploadedObjects.push(parseStoragePathFromUrl(imageUrl));

        const hrAdd = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'HRAgent',
                tool_name: 'hire_staff',
                parameters: {
                    name: 'Regression Staff',
                    designation: 'Caretaker',
                    contact: {
                        primary: staffPhone,
                        email: staffEmail,
                    },
                },
            }),
        });

        const financeVendor = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'FinanceAI',
                tool_name: 'add_vendor',
                parameters: {
                    vendor_name: vendorName,
                    category: 'Maintenance',
                    primary_phone: '+917000001111',
                },
            }),
        });

        const financeLookup = await expectJson(`${backendUrl}/api/master_ai/tools/execute`, {
            method: 'POST',
            headers: baseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                agent_name: 'FinanceAI',
                tool_name: 'get_vendors',
                parameters: {
                    search: vendorName,
                    limit: 5,
                },
            }),
        });

        const artifactUpload = await uploadForm('/api/upload/artifacts', 'artifacts', 'regression-artifact.txt', artifactBuffer, 'text/plain');
        const artifactUrl = artifactUpload.data?.urls?.[0];
        uploadedObjects.push(parseStoragePathFromUrl(artifactUrl));

        const chatForm = new FormData();
        chatForm.append('messages', JSON.stringify([
            { role: 'user', content: 'Please confirm the regression image attachment.' },
        ]));
        chatForm.append('user', JSON.stringify({
            email: actorEmail || 'token-user@example.com',
            name: 'Regression Runner',
            tenant_id: tenantId,
        }));
        chatForm.append('attachments', new Blob([imageBuffer], { type: 'image/jpeg' }), 'regression-chat.jpg');
        const chatPayload = await expectJson(`${backendUrl}/api/communications/chat`, {
            method: 'POST',
            headers: baseHeaders(),
            body: chatForm,
        });
        const chatImageUrl = chatPayload.uploaded_image_urls?.[0];
        uploadedObjects.push(parseStoragePathFromUrl(chatImageUrl));

        console.log(JSON.stringify({
            backendUrl,
            tenantId,
            actorEmail: actorEmail || null,
            results: {
                authContext: authContext.data,
                crmAdd: crmAdd.data,
                crmLookup: crmLookup.data,
                propertyAdd: propertyAdd.data,
                unitAdd: unitAdd.data,
                imageUpload: imageUpload.data,
                hrAdd: hrAdd.data,
                financeVendor: financeVendor.data,
                financeLookup: financeLookup.data,
                artifactUpload: artifactUpload.data,
                chat: {
                    uploaded_image_urls: chatPayload.uploaded_image_urls || [],
                    content: chatPayload.data?.content || chatPayload.data?.reply || null,
                },
            },
        }, null, 2));
    } finally {
        await restoreNamespaces(snapshot);
        await deleteUploadedObjects(uploadedObjects);
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
