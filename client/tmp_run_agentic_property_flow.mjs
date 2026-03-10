import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE_UI = 'http://127.0.0.1:5273';
const BASE_API = 'http://127.0.0.1:3001';
const IMAGE_PATH = '/tmp/agentic_test_property_image.png';
const runId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

if (!fs.existsSync(IMAGE_PATH)) {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Y7p8AAAAASUVORK5CYII=';
  fs.writeFileSync(IMAGE_PATH, Buffer.from(png, 'base64'));
}

const ceos = [
  { label: 'Aarav Sharma', email: 'ceo.aarav.sharma@example.com', mode: 'ui' },
  { label: 'Neha Kapoor', email: 'ceo.neha.kapoor@example.com', mode: 'ui' },
  { label: 'Maya Verma', email: 'ceo.maya.verma@example.com', mode: 'ui' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withLoggedInContext(persona) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  await page.goto(`${BASE_UI}/login`, { waitUntil: 'networkidle' });
  await page.getByText('Developer / Automated Agent Access').click();
  await page.locator('input[type="email"]').fill(persona.email);
  await page.getByRole('button', { name: 'Inject Context & Bypass' }).click();
  await page.waitForURL('**/master', { timeout: 20000 });
  await page.waitForTimeout(1200);

  return { browser, context, page };
}

async function runUiFlow(persona) {
  const result = { persona: persona.label, mode: 'ui', status: 'ok', steps: [] };
  const { browser, context, page } = await withLoggedInContext(persona);

  try {
    await page.getByRole('link', { name: 'Property & Booking' }).click();
    await page.getByRole('heading', { name: 'Property & Booking' }).waitFor({ timeout: 20000 });

    const propertyName = `${persona.label.replace(/\s+/g, '-')}-Property-${runId}`;
    const editedName = `${propertyName}-Edited`;

    await page.locator('xpath=//div[contains(@class,\"w-1/3\")]//button[contains(normalize-space(.), \"Add\")]').first().click();
    await page.locator('input[placeholder="e.g. Emerald Heights"]').fill(propertyName);
    await page.locator('input[placeholder="e.g. 411014"]').fill('411015');
    await page.locator('input[placeholder="e.g. Viman Nagar"]').fill('Kharadi');
    await page.locator('input[placeholder="e.g. Pune"]').fill('Pune');
    await page.locator('input[placeholder="e.g. Maharashtra"]').fill('Maharashtra');
    await page.locator('input[placeholder="Building, street, landmark..."]').fill('12, Test Avenue');
    await page.locator('textarea[placeholder="Describe the building..."]').fill('Automated test property for agentic flow');
    await page.locator('input[placeholder="e.g. 3"]').fill('4');
    await page.locator('input[placeholder="e.g. https://maps.app.goo.gl/..."]').fill('https://maps.app.goo.gl/test');

    const imageInput = page.locator('input[type="file"]').first();
    await imageInput.setInputFiles(IMAGE_PATH);

    await page.locator('input[placeholder="e.g. Gym, WiFi (Press Tab to add)"]').fill('Gym');
    await page.getByRole('button', { name: 'Add Amenity' }).click();

    await page.getByRole('button', { name: 'Save Property' }).click();
    await page.waitForTimeout(1200);
    result.steps.push('property_created');

    await page.getByRole('button', { name: 'Edit Details' }).click();
    await page.locator('input[placeholder="e.g. Emerald Heights"]').fill(editedName);
    await page.locator('textarea[placeholder="Describe the building..."]').fill('Automated test property updated for edit coverage');
    await page.getByRole('button', { name: 'Save Property' }).click();
    await page.waitForTimeout(1200);
    result.steps.push('property_edited');

    await page.getByRole('button', { name: 'Add Unit' }).click();
    await page.locator('input[placeholder="e.g. 101"]').fill('101');
    await page.locator('input[placeholder="e.g. 1"]').fill('1');
    await page.getByRole('button', { name: '+ Single Sharing' }).click();
    await page.locator('input[placeholder="Monthly Rent"]').fill('12000');
    await page.getByRole('button', { name: 'Add Unit' }).click();
    await page.waitForTimeout(800);

    await page.getByRole('button', { name: 'Add Unit' }).click();
    await page.locator('input[placeholder="e.g. 101"]').fill('102');
    await page.locator('input[placeholder="e.g. 1"]').fill('2');
    await page.getByRole('button', { name: '+ Double Sharing' }).click();
    await page.locator('input[placeholder="Monthly Rent"]').fill('12500');
    await page.getByRole('button', { name: 'Add Unit' }).click();
    await page.waitForTimeout(900);
    result.steps.push('units_created');

    await page.locator('button[aria-label="Edit Unit 101"]').first().click({ force: true });
    await page.locator('input[placeholder="Monthly Rent"]').fill('13500');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(800);
    result.steps.push('unit_edited');

    await page.locator('button[aria-label="Delete Unit 102"]').first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('button[aria-label="Delete Unit 101"]').first().click({ force: true });
    await page.waitForTimeout(800);
    result.steps.push('units_deleted');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Property' }).click();
    await page.waitForTimeout(1200);
    result.steps.push('property_deleted');
    result.status = 'pass';
    result.propertyName = editedName;
  } catch (error) {
    result.status = 'fail';
    result.error = String(error?.message || error);
  } finally {
    await context.close();
    await browser.close();
  }

  return result;
}

async function apiGetThread(phone) {
  const response = await fetch(`${BASE_API}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`);
  const body = await response.json();
  return body.data?.items || [];
}

async function apiSend(phone, bodyText) {
  const response = await fetch(`${BASE_API}/api/simulator/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: phone, body: bodyText }),
  });
  return response.json();
}

async function waitForNextOutbound(phone, previousLength, timeoutMs = 14000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(500);
    const items = await apiGetThread(phone);
    if (items.length > previousLength) {
      const last = items.at(-1);
      if (last?.direction === 'outbound') {
        return last;
      }
    }
  }
  throw new Error('No outbound reply observed in WhatsApp thread');
}

async function runRohanFlow() {
  const result = { persona: 'Rohan Iyer', mode: 'whatsapp', status: 'ok', steps: [] };
  const phone = '+919800098003';

  try {
    const clear = await fetch(`${BASE_API}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' });
    if (!clear.ok) throw new Error('could not clear thread');

    const baseItems = await apiGetThread(phone);
    const baseLen = baseItems.length;
    const propertyName = `Rohan-Agentic-Property-${runId}`;

    await apiSend(phone, `Create property name ${propertyName}, address MG Road, Pune, floors 5, amenities Gym, WiFi, description automated run for agentic-loop. Proceed now.`);
    const createReply = await waitForNextOutbound(phone, baseLen);
    if (!/successfully created/i.test(createReply.body || '')) {
      throw new Error(`unexpected create reply: ${createReply.body}`);
    }

    const afterCreateLen = (await apiGetThread(phone)).length;
    await apiSend(phone, `Add unit 101, floor 1, base rent 12000, types Single Sharing, amenities Gym, WiFi to property ${propertyName}.`);
    const addU1 = await waitForNextOutbound(phone, afterCreateLen);
    if (!/successfully added/i.test(addU1.body || '')) throw new Error(`unexpected unit add 101 reply: ${addU1.body}`);

    const afterU1Len = (await apiGetThread(phone)).length;
    await apiSend(phone, `Add unit 102, floor 2, base rent 12500, types Double Sharing, amenities Gym to property ${propertyName}.`);
    const addU2 = await waitForNextOutbound(phone, afterU1Len);
    if (!/successfully added/i.test(addU2.body || '')) throw new Error(`unexpected unit add 102 reply: ${addU2.body}`);

    const afterU2Len = (await apiGetThread(phone)).length;
    await apiSend(phone, `Edit unit 101 in property ${propertyName}, set base rent to 13000.`);
    const editU = await waitForNextOutbound(phone, afterU2Len);
    if (!/successfully updated/i.test(editU.body || '')) throw new Error(`unexpected edit reply: ${editU.body}`);

    const afterEditLen = (await apiGetThread(phone)).length;
    await apiSend(phone, `Delete unit 101 in property ${propertyName}.`);
    const delU1 = await waitForNextOutbound(phone, afterEditLen);
    if (!/successfully deleted/i.test(delU1.body || '')) throw new Error(`unexpected delete 101 reply: ${delU1.body}`);

    const afterDelU1Len = (await apiGetThread(phone)).length;
    await apiSend(phone, `Delete unit 102 in property ${propertyName}.`);
    const delU2 = await waitForNextOutbound(phone, afterDelU1Len);
    if (!/successfully deleted/i.test(delU2.body || '')) throw new Error(`unexpected delete 102 reply: ${delU2.body}`);

    const afterDelU2Len = (await apiGetThread(phone)).length;
    await apiSend(phone, `Get details for property ${propertyName}.`);
    const details = await waitForNextOutbound(phone, afterDelU2Len);
    const idMatch = /\*\*ID\*\*:\s*(PROP-\d+)/.exec(details.body || '');
    const propertyId = idMatch?.[1];
    if (!propertyId) throw new Error(`Could not resolve property ID: ${details.body}`);

    const afterDetailsLen = (await apiGetThread(phone)).length;
    await apiSend(phone, `Delete property ${propertyId}.`);
    const delP = await waitForNextOutbound(phone, afterDetailsLen);
    if (!/successfully deleted/i.test(delP.body || '')) throw new Error(`unexpected delete property reply: ${delP.body}`);

    result.steps = ['property_created', 'units_created', 'unit_edited', 'units_deleted', 'property_deleted'];
    result.propertyId = propertyId;
    result.status = 'pass';
  } catch (error) {
    result.status = 'fail';
    result.error = String(error?.message || error);
  }

  return result;
}

const allResults = [];
for (const persona of ceos) {
  allResults.push(await runUiFlow(persona));
}
allResults.push(await runRohanFlow());

console.log(JSON.stringify(allResults, null, 2));
