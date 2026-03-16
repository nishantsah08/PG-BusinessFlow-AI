import { test, expect } from '@playwright/test';
import { bootstrapTenant, setLocalUser, verifyCeoPhone } from './helpers/auth';

test.use({
    viewport: { width: 1440, height: 960 },
});

async function openSop(page, name) {
    const button = page.locator(`xpath=//div[normalize-space()="${name}"]/ancestor::div[.//button[normalize-space()="Open"]][1]//button[normalize-space()="Open"]`).first();
    await expect(button).toBeVisible();
    await button.click();
}

test.describe('SOP studio live flow', () => {
    test('covers active edit, draft validation, publish, archive, invalid finance edit, and blank new SOP creation', async ({ page, request }) => {
        test.setTimeout(240000);

        const stamp = Date.now();
        const ceoEmail = `sop.gui.qa.${stamp}@example.com`;
        const ceoPhone = `+9178${String(stamp).slice(-8)}`;

        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `SOP GUI QA ${stamp}`,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });

        await setLocalUser(page, {
            email: ceoEmail,
            name: `SOP GUI QA ${stamp}`,
            tenant_id: tenantId,
            tenantId,
            profile_type: 'CEO',
            type: 'Bypass',
        });

        await page.goto('/workflows');
        await expect(page.getByRole('heading', { name: 'SOPs' })).toBeVisible({ timeout: 15000 });

        await page.getByRole('button', { name: 'New SOP' }).click();
        await expect(page.getByRole('button', { name: 'Brand New SOP' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Based on Existing SOP' })).toBeVisible();
        await page.getByRole('button', { name: 'Based on Existing SOP' }).click();
        await expect(page.getByPlaceholder('Search existing SOPs...')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Use This SOP' }).first()).toBeVisible();
        await page.getByRole('button', { name: 'Back' }).click();
        await page.getByLabel('Close Create SOP').click();

        const tableBox = await page.locator('text=Record Booking Hold').first().boundingBox();
        expect(tableBox?.x ?? 0).toBeGreaterThan(0);

        await expect(page.getByText('Record Booking Hold')).toBeVisible();
        await expect(page.getByText('Generate Monthly Bills')).toBeVisible();
        await expect(page.getByText('Rent Collection')).toBeVisible();
        await expect(page.getByText('Offboard Tenant')).toBeVisible();
        await expect(page.getByText('Correct Finance Entry')).toBeVisible();

        await openSop(page, 'Record Booking Hold');

        const workspace = page.getByTestId('workflow-workspace');
        await expect(workspace).toBeVisible();
        const workspaceBox = await workspace.boundingBox();
        expect(workspaceBox?.width ?? 0).toBeGreaterThan(1400);
        expect(workspaceBox?.height ?? 0).toBeGreaterThan(900);
        await expect(page.getByTestId('workflow-workspace').getByRole('button', { name: 'Create Custom Draft' })).toBeVisible();
        await page.getByTestId('workflow-workspace').getByRole('button', { name: 'Create Custom Draft' }).click();
        await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
        await expect(page.getByText('Custom draft created from the default SOP.')).toBeVisible();

        await expect(page.getByText('Confirm what money has been received.')).toBeVisible();
        await expect(page.getByText('Review the payment proof.')).toBeVisible();

        await page.getByPlaceholder('Ask about this SOP...').fill('Explain this SOP');
        await page.getByRole('button', { name: 'Send' }).click();
        await expect(page.getByTestId('sop-chat-message-assistant').last()).toContainText('pre-onboarding booking hold payment');
        await expect(page.getByTestId('sop-chat-proposal')).toHaveCount(0);

        await page.getByPlaceholder('Ask about this SOP...').fill('Clarify the business handoff');
        await page.getByRole('button', { name: 'Send' }).click();
        await expect(page.getByText('Clarify the business outcome and strengthen the final operating handoff.')).toBeVisible();
        await page.getByRole('button', { name: 'Apply Change' }).click();
        await expect(page.getByText('Change applied. The SOP document now shows the updated draft.')).toBeVisible();
        await expect(page.getByText('follow-up deadline')).toBeVisible();

        await page.getByRole('button', { name: 'Validate' }).click();
        await expect(page.getByText('Validated. Ready to publish.')).toBeVisible();

        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(page.getByText('Publish Record Booking Hold?')).toBeVisible();
        await page.getByRole('button', { name: 'Publish Now' }).click();
        await expect(page.getByRole('heading', { name: 'SOPs' })).toBeVisible();

        await openSop(page, 'Record Booking Hold');
        await expect(page.getByTestId('workflow-workspace').getByRole('button', { name: 'Archive' })).toBeVisible();
        await page.getByTestId('workflow-workspace').getByRole('button', { name: 'Archive' }).click();
        await expect(page.getByRole('heading', { name: 'SOPs' })).toBeVisible();
        await page.getByRole('button', { name: 'Archived' }).click();
        await expect(page.getByText('Record Booking Hold', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'All' }).click();
        await openSop(page, 'Correct Finance Entry');
        await page.getByPlaceholder('Ask about this SOP...').fill('Remove rollback requirement');
        await page.getByRole('button', { name: 'Send' }).click();
        await expect(page.getByText('Remove the failure and rollback rule from this SOP.')).toBeVisible();
        await page.getByRole('button', { name: 'Apply Change' }).click();
        await page.getByRole('button', { name: 'Validate' }).click();
        await expect(page.getByText('Validation failed. Needs correction.')).toBeVisible();
        await page.getByPlaceholder('Ask about this SOP...').fill('Remove approval');
        await page.getByRole('button', { name: 'Send' }).click();
        await expect(page.getByText('Remove approval from this SOP.')).toBeVisible();
        await page.getByRole('button', { name: 'Discard' }).click();
        await expect(page.getByText('Proposal discarded. The SOP document has not changed.')).toBeVisible();
        await page.getByLabel('Close').click();

        await page.getByRole('button', { name: 'New SOP' }).click();
        await page.getByRole('button', { name: 'Brand New SOP' }).click();
        await expect(page.getByTestId('workflow-workspace').locator('h1', { hasText: 'Untitled SOP Draft' })).toBeVisible();
        await expect(page.getByText('Start with the assistant on the right to prepare this SOP.')).toBeVisible();
        await expect(page.getByTestId('sop-chat-empty')).toBeEmpty();
        await expect(page.getByText('Ask for a change, clarification, or explanation for this SOP.')).toHaveCount(0);

        await page.getByPlaceholder('Ask about this SOP...').fill('Create a monthly billing SOP for serviced apartments');
        await page.getByRole('button', { name: 'Send' }).click();
        await expect(page.getByText('Create the first SOP draft for "Monthly Billing SOP For Serviced Apartments".')).toBeVisible();
        await page.getByRole('button', { name: 'Apply Change' }).click();
        await expect(page.getByTestId('workflow-workspace').locator('h1', { hasText: 'Monthly Billing SOP For Serviced Apartments' })).toBeVisible();
        await expect(page.getByText('Confirm who needs to be billed.')).toBeVisible();

        await page.getByRole('button', { name: 'Validate' }).click();
        await expect(page.getByText('Validated. Ready to publish.')).toBeVisible();
        await page.getByLabel('Close').click();

        await page.getByRole('button', { name: 'Draft' }).click();
        await expect(page.getByText('Monthly Billing SOP For Serviced Apartments', { exact: true })).toBeVisible();
    });
});
