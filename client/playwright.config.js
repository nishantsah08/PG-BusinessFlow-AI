import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.E2E_PORT || '5273';
const e2eApiPort = process.env.E2E_API_PORT || '3101';
const defaultBaseURL = `http://127.0.0.1:${e2ePort}`;
const defaultWebServerCmd = `VITE_PROXY_TARGET=http://127.0.0.1:${e2eApiPort} npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: process.env.PW_BASE_URL || defaultBaseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: process.env.PW_WEB_SERVER_CMD || defaultWebServerCmd,
        url: process.env.PW_WEB_SERVER_URL || defaultBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
