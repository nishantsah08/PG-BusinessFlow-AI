const { spawn } = require('child_process');
const path = require('path');
const TimeAuthorityService = require('../../server/src/services/TimeAuthorityService');

jest.setTimeout(30000);

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const PRELOAD_PATH = path.join(__dirname, 'mocks', 'MockPortalChatOpenAI.cjs');
const TEST_PORT = '3117';

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

describe('Portal chat HTTP path', () => {
    let serverProcess = null;

    beforeAll(async () => {
        serverProcess = spawn(process.execPath, ['src/index.js'], {
            cwd: SERVER_DIR,
            env: {
                ...process.env,
                PORT: TEST_PORT,
                APP_ENV: 'development',
                OPENAI_API_KEY: 'sk-mock-key',
                NODE_OPTIONS: `--require ${PRELOAD_PATH}`
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

    test('portal chat endpoint returns a deterministic assistant reply with IST timestamp', async () => {
        const response = await fetch(`http://localhost:${TEST_PORT}/api/communications/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-actor-email': 'ceo.maya.verma@example.com',
                'x-tenant-id': 'ceo_maya_verma_example_com'
            },
            body: JSON.stringify({
                message: 'Hello from automated portal chat route test',
                user: {
                    email: 'ceo.maya.verma@example.com',
                    name: 'Maya Verma',
                    profile_type: 'CEO',
                    tenant_id: 'ceo_maya_verma_example_com'
                }
            })
        });
        const payload = await response.json();

        expect(response.ok).toBe(true);
        expect(payload.success).toBe(true);
        expect(payload.data).toBeTruthy();
        expect(payload.data.role).toBe('assistant');
        expect(payload.data.content).toBe('Mock portal chat HTTP response.');
        expect(TimeAuthorityService.validateIST(payload.data.timestamp_ist)).toBe(true);
        expect(Array.isArray(payload.uploaded_image_urls)).toBe(true);
        expect(payload.uploaded_image_urls).toHaveLength(0);
    });
});
