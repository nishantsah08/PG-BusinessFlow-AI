import { test, expect } from '@playwright/test';

test('captures current default HR view', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('master_ai_user', JSON.stringify({
            email: 'nishantsah@outlook.in',
            name: 'Dev Bypass User',
            tenant_id: 'default',
            tenantId: 'default',
            profile_type: 'CEO',
            type: 'Bypass',
        }));
    });

    page.on('console', (message) => {
        console.log(`browser-console:${message.type()}:${message.text()}`);
    });

    await page.goto('/hr');
    await expect(page.getByRole('heading', { name: 'People and compensation' })).toBeVisible();

    const pageText = await page.locator('body').innerText();
    console.log(pageText);

    await page.screenshot({ path: 'test-results/hr-current-default-view.png', fullPage: true });
});
