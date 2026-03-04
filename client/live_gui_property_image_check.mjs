import { chromium } from '@playwright/test';

const baseUrl = process.env.GUI_BASE_URL || 'http://localhost:5274';
const image1 = '/home/nishant/PG-BusinessFlow.ai/images/chat_upload_1772543951413_jl1q89.jpg';
const image2 = '/home/nishant/PG-BusinessFlow.ai/images/chat_upload_1772543951414_7ot31a.png';
const unique = `LiveCheck_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const step = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    console.log(`PASS ${name} (${Date.now()-start}ms)`);
  } catch (e) {
    console.error(`FAIL ${name}: ${e.message}`);
    await page.screenshot({ path: '/tmp/live_gui_property_image_check_fail.png', fullPage: true });
    throw e;
  }
};

const sendMessage = async (text) => {
  await page.getByPlaceholder('Instruct MasterAI...').fill(text);
  await page.locator('form button[type="submit"]').click();
};

try {
  await step('Open app with bypass user', async () => {
    await page.addInitScript(() => {
      localStorage.setItem('master_ai_user', JSON.stringify({ email: 'qa@test.local', name: 'QA User', type: 'Bypass' }));
      localStorage.setItem('pg_developer_mode', 'true');
    });
    await page.goto(`${baseUrl}/master`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'MasterAI Interface' }).waitFor({ timeout: 15000 });
  });

  await step('Upload images and request property creation', async () => {
    await page.locator('input[type="file"]').setInputFiles([image1, image2]);
    await sendMessage(`create a property with name ${unique} in Dighi Hills Pune 411015 no optional fields`);
  });

  await step('Confirm and complete property creation', async () => {
    await page.locator('div.text-sm.whitespace-pre-wrap').last().waitFor({ timeout: 60000 });
    await sendMessage('yes proceed and create without optional fields');

    const successHints = [
      'has been successfully created',
      'Property Added',
      'property has been created',
      'created with the ID'
    ];

    let created = false;
    for (const hint of successHints) {
      if (await page.getByText(hint, { exact: false }).count()) {
        created = true;
        break;
      }
    }

    if (!created) {
      await page.waitForTimeout(2000);
      await sendMessage(`create now with available fields only for property ${unique}`);
      await page.getByText('created', { exact: false }).first().waitFor({ timeout: 90000 });
    }
  });

  await step('Request property images', async () => {
    await sendMessage(`show me the picture of property ${unique}`);
  });

  await step('Verify inline images rendered', async () => {
    await page.locator('[data-testid="inline-image-button"]').first().waitFor({ timeout: 90000 });
    const count = await page.locator('[data-testid="inline-image-button"]').count();
    console.log(`INFO inline image buttons: ${count}`);
    if (count < 1) throw new Error('No inline images rendered');
  });

  await step('Verify lightbox open, navigate, close', async () => {
    await page.locator('[data-testid="inline-image-button"]').first().click();
    await page.getByTestId('image-lightbox').waitFor({ timeout: 10000 });
    await page.getByTestId('lightbox-image').waitFor({ timeout: 10000 });
    const src1 = await page.getByTestId('lightbox-image').getAttribute('src');
    console.log(`INFO lightbox src1: ${src1}`);
    const total = await page.locator('[data-testid="inline-image-button"]').count();
    if (total > 1) {
      await page.getByTestId('lightbox-next').click();
      const src2 = await page.getByTestId('lightbox-image').getAttribute('src');
      console.log(`INFO lightbox src2: ${src2}`);
    }
    await page.keyboard.press('Escape');
    const stillOpen = await page.getByTestId('image-lightbox').count();
    if (stillOpen !== 0) throw new Error('Lightbox did not close');
  });

  console.log('RESULT: LIVE GUI PROPERTY IMAGE FLOW PASS');
} finally {
  await browser.close();
}
