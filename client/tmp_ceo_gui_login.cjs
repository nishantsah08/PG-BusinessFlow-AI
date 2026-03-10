const { chromium } = require('@playwright/test');
const fs = require('fs');

const runs = [
  {
    issueDir: '/home/nishant/PG-BusinessFlow.ai/testing/agentic_loop/issues/Issues 1',
    email: 'aditi.rao.skyline@example.com',
    label: 'Aditi Rao'
  },
  {
    issueDir: '/home/nishant/PG-BusinessFlow.ai/testing/agentic_loop/issues/Issues 2',
    email: 'rohan.mehta.orbit@example.com',
    label: 'Rohan Mehta'
  }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const run of runs) {
    const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
    const page = await context.newPage();

    await page.goto('http://127.0.0.1:5273/login', { waitUntil: 'networkidle' });
    await page.getByText('Developer / Automated Agent Access').click();
    await page.screenshot({ path: `${run.issueDir}/step2_gui_login_form.png`, fullPage: true });

    await page.locator('input[type="email"]').fill(run.email);
    await page.getByRole('button', { name: 'Inject Context & Bypass' }).click();
    await page.waitForURL('**/master', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${run.issueDir}/step2_gui_post_login_master.png`, fullPage: true });

    const marker = {
      persona: run.label,
      email: run.email,
      final_url: page.url(),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(`${run.issueDir}/step2_gui_result.json`, JSON.stringify(marker, null, 2));

    await context.close();
  }
  await browser.close();
})();
