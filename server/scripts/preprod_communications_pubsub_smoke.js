const { PubSub, v1 } = require('@google-cloud/pubsub');

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'fir-bestpg';
const backendUrl = process.env.BACKEND_URL || 'https://pgbf-backend-development-57ju5cwl3a-el.a.run.app';
const topicName = process.env.PUBSUB_COMMUNICATIONS_TOPIC || 'pgbf-development-whatsapp-events';
const subscriptionName = process.env.PUBSUB_COMMUNICATIONS_PUSH_SUBSCRIPTION || 'pgbf-development-whatsapp-events-push';
const pushAudience = process.env.PUBSUB_PUSH_AUDIENCE || `${backendUrl}/api/internal/events/whatsapp`;
const pushServiceAccountEmail = process.env.PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL || `pgbf-pubsub-push@${projectId}.iam.gserviceaccount.com`;

async function main() {
    const pubsub = new PubSub({ projectId });
    const subscriberClient = new v1.SubscriberClient({ projectId });
    const topic = pubsub.topic(topicName);
    const subscription = pubsub.subscription(subscriptionName);

    const [topicExists] = await topic.exists();
    if (!topicExists) {
        throw new Error(`Missing Pub/Sub topic: ${topicName}`);
    }

    const [subscriptionExists] = await subscription.exists();
    if (!subscriptionExists) {
        throw new Error(`Missing Pub/Sub push subscription: ${subscriptionName}`);
    }

    const [metadata] = await subscription.getMetadata();
    const pushConfig = metadata?.pushConfig || {};
    const oidcToken = pushConfig?.oidcToken || {};
    const endpoint = String(pushConfig.pushEndpoint || '');

    if (endpoint !== `${backendUrl}/api/internal/events/whatsapp`) {
        throw new Error(`Push endpoint mismatch. Expected ${backendUrl}/api/internal/events/whatsapp, got ${endpoint || 'missing'}`);
    }
    if (String(oidcToken.serviceAccountEmail || '').trim().toLowerCase() !== pushServiceAccountEmail.toLowerCase()) {
        throw new Error(`Push service account mismatch. Expected ${pushServiceAccountEmail}, got ${oidcToken.serviceAccountEmail || 'missing'}`);
    }
    if (String(oidcToken.audience || '').trim() !== pushAudience) {
        throw new Error(`Push audience mismatch. Expected ${pushAudience}, got ${oidcToken.audience || 'missing'}`);
    }

    const tmpSubName = `${topicName}-smoke-${Date.now()}`;
    const [tmpSub] = await topic.createSubscription(tmpSubName, {
        expirationPolicy: { ttl: { seconds: 86400 } },
        ackDeadlineSeconds: 20,
    });

    try {
        const payload = {
            kind: 'whatsapp_webhook_received',
            payload: {
                object: 'whatsapp_business_account',
                entry: [],
            },
            received_at: new Date().toISOString(),
        };
        const messageId = await topic.publishMessage({
            data: Buffer.from(JSON.stringify(payload), 'utf8'),
            attributes: {
                source: 'preprod_pubsub_smoke',
            },
        });

        const subscriptionPath = subscriberClient.subscriptionPath(projectId, tmpSubName);
        const [pullResponse] = await subscriberClient.pull({
            subscription: subscriptionPath,
            maxMessages: 1,
        });
        const receivedMessages = pullResponse.receivedMessages || [];
        if (!receivedMessages.length) {
            throw new Error('Smoke publish could not be pulled from temporary subscription.');
        }
        await subscriberClient.acknowledge({
            subscription: subscriptionPath,
            ackIds: receivedMessages.map((message) => message.ackId).filter(Boolean),
        });

        console.log(JSON.stringify({
            projectId,
            topicName,
            subscriptionName,
            backendUrl,
            pushEndpoint: endpoint,
            pushServiceAccountEmail,
            pushAudience,
            smokePublishMessageId: messageId,
            smokePullCount: receivedMessages.length,
        }, null, 2));
    } finally {
        await tmpSub.delete().catch(() => {});
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
