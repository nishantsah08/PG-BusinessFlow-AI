const { PubSub } = require('@google-cloud/pubsub');
const { OAuth2Client } = require('google-auth-library');

let pubsubClient = null;
const oidcClient = new OAuth2Client();

function getProjectId() {
    return process.env.GCP_PROJECT_ID
        || process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || undefined;
}

function getPubSubClient() {
    if (!pubsubClient) {
        const projectId = getProjectId();
        pubsubClient = projectId ? new PubSub({ projectId }) : new PubSub();
    }
    return pubsubClient;
}

function getEventBackend() {
    return String(process.env.COMMUNICATIONS_EVENT_BACKEND || 'direct').trim().toLowerCase();
}

function isPubSubEnabled() {
    return getEventBackend() === 'pubsub';
}

function getTopicName() {
    return String(process.env.PUBSUB_COMMUNICATIONS_TOPIC || '').trim();
}

function getPushAudience() {
    return String(process.env.PUBSUB_PUSH_AUDIENCE || '').trim();
}

function getPushServiceAccountEmail() {
    return String(process.env.PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL || '').trim().toLowerCase();
}

function getTopicHandle() {
    const topicName = getTopicName();
    if (!topicName) {
        throw new Error('PUBSUB_COMMUNICATIONS_TOPIC is required when COMMUNICATIONS_EVENT_BACKEND=pubsub');
    }
    return getPubSubClient().topic(topicName);
}

async function publishJsonMessage(payload, attributes = {}) {
    if (!isPubSubEnabled()) {
        throw new Error('Communications Pub/Sub backend is not enabled.');
    }
    const topic = getTopicHandle();
    const dataBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
    const messageId = await topic.publishMessage({ data: dataBuffer, attributes });
    return { messageId, topic: topic.name };
}

function decodePushEnvelope(body = {}) {
    const data = body?.message?.data;
    if (!data) {
        throw new Error('Pub/Sub push body missing message.data');
    }
    const raw = Buffer.from(String(data), 'base64').toString('utf8');
    return JSON.parse(raw);
}

async function verifyPushRequest(req) {
    const authHeader = String(req.headers?.authorization || '').trim();
    if (!authHeader.startsWith('Bearer ')) {
        throw new Error('Missing Pub/Sub push bearer token.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const audience = getPushAudience();
    if (!audience) {
        throw new Error('PUBSUB_PUSH_AUDIENCE is required when COMMUNICATIONS_EVENT_BACKEND=pubsub');
    }

    const ticket = await oidcClient.verifyIdToken({
        idToken: token,
        audience,
    });
    const payload = ticket.getPayload() || {};
    const expectedEmail = getPushServiceAccountEmail();
    const tokenEmail = String(payload.email || '').trim().toLowerCase();

    if (expectedEmail && tokenEmail !== expectedEmail) {
        throw new Error(`Pub/Sub push token email mismatch. Expected ${expectedEmail}, received ${tokenEmail || 'unknown'}.`);
    }

    if (payload.email_verified === false) {
        throw new Error('Pub/Sub push token email is not verified.');
    }

    return payload;
}

module.exports = {
    isPubSubEnabled,
    getTopicName,
    getPushAudience,
    getPushServiceAccountEmail,
    publishJsonMessage,
    decodePushEnvelope,
    verifyPushRequest,
};
