const { spawn } = require('child_process');

const port = Number(process.env.LOCAL_COMMUNICATIONS_TEST_PORT || 3201);
const baseUrl = `http://127.0.0.1:${port}`;
const serverCwd = process.cwd();

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 30000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) {
                return response.json();
            }
        } catch (_error) {
            // Keep polling until the server is ready.
        }
        await sleep(500);
    }
    throw new Error(`Local server did not become healthy within ${timeoutMs}ms.`);
}

async function postWebhookPayload() {
    const nowSeconds = String(Math.floor(Date.now() / 1000));
    const response = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            object: 'whatsapp_business_account',
            entry: [{
                id: 'local-direct-smoke',
                changes: [{
                    field: 'messages',
                    value: {
                        messaging_product: 'whatsapp',
                        messages: [{
                            from: '917999999999',
                            id: `wamid.local.direct.smoke.${Date.now()}`,
                            timestamp: nowSeconds,
                            text: { body: 'local direct smoke' },
                            type: 'text',
                        }],
                    },
                }],
            }],
        }),
    });
    return response;
}

async function main() {
    let logs = '';
    const child = spawn('node', ['src/index.js'], {
        cwd: serverCwd,
        env: {
            ...process.env,
            PORT: String(port),
            APP_ENV: 'development',
            STORAGE_BACKEND: 'local',
            COMMUNICATIONS_EVENT_BACKEND: 'direct',
            ALLOW_DEBUG_ENDPOINTS: 'true',
            ALLOW_EXTERNAL_SEND: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
        logs += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
        logs += chunk.toString();
    });

    try {
        const health = await waitForHealth();
        const response = await postWebhookPayload();
        const body = await response.text();
        await sleep(1000);

        if (response.status !== 200) {
            throw new Error(`Local direct webhook returned ${response.status}: ${body}`);
        }
        if (!logs.includes("Incoming Webhook: received payload")) {
            throw new Error('Local direct webhook request did not reach the incoming WhatsApp handler.');
        }

        console.log(JSON.stringify({
            baseUrl,
            health,
            webhookStatus: response.status,
            webhookBody: body || 'OK',
            directModeConfirmed: true,
        }, null, 2));
    } finally {
        child.kill('SIGINT');
        await new Promise((resolve) => child.once('exit', resolve)).catch(() => {});
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
