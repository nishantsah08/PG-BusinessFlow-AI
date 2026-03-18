const { spawn } = require('child_process');
const path = require('path');
const TimeAuthorityService = require('../../server/src/services/TimeAuthorityService');

jest.setTimeout(30000);

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const TEST_PORT = '3116';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port, attempts = 20) {
    for (let i = 0; i < attempts; i += 1) {
        try {
            const response = await fetch(`http://localhost:${port}/health`);
            if (response.ok) return true;
        } catch (_err) {
            // retry
        }
        await sleep(500);
    }
    throw new Error(`Server did not become healthy on port ${port}`);
}

async function waitForThreadItems(port, phone, minItems = 2, attempts = 20) {
    for (let i = 0; i < attempts; i += 1) {
        const response = await fetch(`http://localhost:${port}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`);
        const payload = await response.json();
        const items = payload?.data?.items || [];
        if (items.length >= minItems) return items;
        await sleep(500);
    }
    throw new Error(`Expected at least ${minItems} thread items for ${phone}`);
}

describe('WhatsApp simulator HTTP path', () => {
    let serverProcess = null;

    beforeAll(async () => {
        serverProcess = spawn(process.execPath, ['src/index.js'], {
            cwd: SERVER_DIR,
            env: {
                ...process.env,
                PORT: TEST_PORT,
                APP_ENV: 'development',
                ALLOW_DEV_BYPASS_IN_PROD: 'true'
            },
            stdio: 'ignore'
        });

        await waitForHealth(TEST_PORT);
    });

    afterAll(async () => {
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
            await sleep(500);
        }
    });

    test('simulator send endpoint records inbound and outbound thread items with IST timestamps', async () => {
        const phone = '+919811111111';

        await fetch(`http://localhost:${TEST_PORT}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`, {
            method: 'DELETE'
        });

        const sendResponse = await fetch(`http://localhost:${TEST_PORT}/api/simulator/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: phone,
                body: 'Hi from automated HTTP simulator test'
            })
        });
        const sendPayload = await sendResponse.json();

        expect(sendResponse.ok).toBe(true);
        expect(sendPayload.success).toBe(true);
        expect(sendPayload.data.from).toBe(phone);
        expect(TimeAuthorityService.validateIST(sendPayload.data.inbound_event.at)).toBe(true);

        const items = await waitForThreadItems(TEST_PORT, phone, 2);
        expect(items.some((item) => item.direction === 'inbound')).toBe(true);
        expect(items.some((item) => item.direction === 'outbound')).toBe(true);

        for (const item of items) {
            expect(TimeAuthorityService.validateIST(item.at)).toBe(true);
        }
    });
});
