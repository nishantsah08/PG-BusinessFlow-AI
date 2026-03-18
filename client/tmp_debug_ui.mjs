import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5273/login', { waitUntil: 'networkidle' });
await page.getByText('Developer / Automated Agent Access').click();
await page.locator('input[type="email"]').fill('ceo.aarav.sharma@example.com');
await page.getByRole('button', { name: 'Inject Context & Bypass' }).click();
await page.waitForURL('**/master');
await page.getByRole('link', { name: 'Property & Booking' }).click();
await page.waitForTimeout(1000);
const url = page.url();
console.log('URL', url);
const buttons = await page.locator('button').allTextContents();
const visibleButtons = [];
for (const i of await page.locator('button').elementHandles()) {
  const txt = await i.textContent();
  const vis = await i.isVisible().catch(() => false);
  if (vis && txt && txt.trim()) visibleButtons.push(txt.trim());
}
console.log('visible buttons', visibleButtons.slice(0, 40));
console.log('first 20 all buttons', buttons.slice(0, 40));
await page.screenshot({ path: '/tmp/aarav-property-debug.png', fullPage: true });
await browser.close();
