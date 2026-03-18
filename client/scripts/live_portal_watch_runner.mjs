import readline from 'readline';
import { chromium } from '@playwright/test';

const baseUrl = process.env.GUI_BASE_URL || 'https://fir-bestpg-development-public.web.app';

function waitForEnter(promptText) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(promptText, () => {
            rl.close();
            resolve();
        });
    });
}

const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 1000,
});

const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
});

const page = await context.newPage();

try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.bringToFront();

    console.log(`Opened ${baseUrl} in a visible Chrome window.`);
    console.log('If the app is not already logged in in this window, complete login there now.');
    await waitForEnter('Press ENTER here when the watched browser is ready for automation...');

    console.log('Browser is ready. Leave this window open.');
    await new Promise(() => {});
} finally {
    await browser.close();
}
