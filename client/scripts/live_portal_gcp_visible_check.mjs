import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.GUI_BASE_URL || 'https://fir-bestpg-development-public.web.app';
const uploadImagePath = process.env.TEST_IMAGE_PATH || '/home/nishant/PG-BusinessFlow.ai/images/chat_upload_1772530892069_gbgmxt.jpg';
const artifactPath = process.env.TEST_ARTIFACT_PATH || '/tmp/pgbf_live_artifact_test.txt';
const bypassEmail = process.env.BYPASS_EMAIL || 'watchceo@example.com';

const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 1000,
});

const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
});

const page = await context.newPage();

const step = async (label, fn) => {
    console.log(`STEP ${label}`);
    await page.bringToFront();
    await fn();
    await page.waitForTimeout(1000);
};

try {
    await page.addInitScript((user) => {
        window.localStorage.setItem('master_ai_user', JSON.stringify(user));
    }, {
        email: bypassEmail,
        name: 'Watch Test User',
        picture: null,
        type: 'Bypass',
    });

    await step('open master', async () => {
        await page.goto(`${baseUrl}/app/master`, { waitUntil: 'domcontentloaded' });
        await page.getByPlaceholder('Instruct MasterAI...').waitFor({ timeout: 30000 });
        const newChatButton = page.getByRole('button', { name: 'New Chat' });
        if (await newChatButton.count()) {
            await newChatButton.click();
        }
    });

    await step('property image upload screen', async () => {
        await page.goto(`${baseUrl}/app/property`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Property & Booking' }).waitFor({ timeout: 30000 });
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await page.getByRole('heading', { name: 'New Property' }).waitFor({ timeout: 15000 });
        const propertyInput = page.locator('input[type="file"]').first();
        await propertyInput.setInputFiles(uploadImagePath);
        await page.locator('img[alt="Property"]').first().waitFor({ timeout: 30000 });
        const src = await page.locator('img[alt="Property"]').first().getAttribute('src');
        console.log(`INFO property preview src: ${src}`);
        if (!src || !src.includes('/api/storage/file?path=')) {
            throw new Error('Property image preview is not using storage file proxy URL.');
        }
    });

    await step('finance artifact upload screen', async () => {
        await page.goto(`${baseUrl}/app/finance`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Incoming', exact: true }).click();
        await page.getByRole('button', { name: 'Add Incoming', exact: true }).waitFor({ timeout: 30000 });
        await page.getByRole('button', { name: 'Add Incoming', exact: true }).click();
        await page.getByText('Upload Files', { exact: false }).first().waitFor({ timeout: 15000 });
        const financeFileInput = page.locator('input[type="file"]').first();
        await financeFileInput.setInputFiles(artifactPath);
        const uploadedFinanceLink = page.locator('a[href*="/api/storage/file?path=artifact"]').first();
        await uploadedFinanceLink.waitFor({ timeout: 30000 });
        const href = await uploadedFinanceLink.getAttribute('href');
        console.log(`INFO finance artifact link rendered: ${href}`);
        if (!href || !href.includes('/api/storage/file?path=artifact')) {
            throw new Error('Finance artifact link is not using artifact storage proxy URL.');
        }
    });

    await step('chat attachment upload', async () => {
        await page.goto(`${baseUrl}/app/master`, { waitUntil: 'domcontentloaded' });
        await page.getByPlaceholder('Instruct MasterAI...').waitFor({ timeout: 30000 });
        await page.locator('input[type="file"]').setInputFiles(uploadImagePath);
        await page.getByPlaceholder('Instruct MasterAI...').fill('Please confirm you received the attached image.');
        const chatResponsePromise = page.waitForResponse((response) => (
            response.url().includes('/api/communications/chat') && response.request().method() === 'POST'
        ), { timeout: 60000 });
        await page.locator('form button[type="submit"]').click();
        const chatResponse = await chatResponsePromise;
        const chatPayload = await chatResponse.json();
        const uploadedUrls = Array.isArray(chatPayload?.uploaded_image_urls) ? chatPayload.uploaded_image_urls : [];
        console.log(`INFO chat uploaded image urls: ${JSON.stringify(uploadedUrls)}`);
        if (!chatPayload?.success || uploadedUrls.length === 0 || !uploadedUrls[0].includes('/api/storage/file?path=')) {
            throw new Error('Chat attachment upload did not return stored image URLs.');
        }
        await expect(page.locator('div.text-sm.whitespace-pre-wrap').last()).toBeVisible({ timeout: 60000 });
        console.log('INFO chat attachment path completed');
    });

    console.log('RESULT live portal GCP visible check passed');
    await page.waitForTimeout(2000);
} finally {
    await browser.close();
}
