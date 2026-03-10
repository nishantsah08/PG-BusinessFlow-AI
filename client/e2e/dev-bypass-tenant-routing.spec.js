import { test, expect } from '@playwright/test';

test.describe('Developer bypass tenant routing', () => {
    test('maps dev bypass email to tenant via bootstrap and stores tenant context', async ({ page }) => {
        await page.route('**/api/auth/bootstrap', async (route) => {
            const request = route.request();
            const payload = request.postDataJSON();

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        tenant_id: payload?.email === 'ceo.maya.verma@example.com' ? 'ceo_maya_verma_example_com' : 'default',
                        profile_type: 'CEO',
                        name: 'Maya Verma'
                    }
                })
            });
        });

        await page.route('**/api/auth/context', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        tenant_id: 'ceo_maya_verma_example_com',
                        email: 'ceo.maya.verma@example.com',
                        profile_type: 'CEO',
                        permissions: { admin_adapter: {} }
                    }
                })
            });
        });

        await page.route('**/api/system/agents', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { agents: [] }
                })
            });
        });

        await page.goto('/login');
        await page.getByText('Developer / Automated Agent Access').click();
        await page.locator('input[type="email"]').fill('ceo.maya.verma@example.com');
        await page.getByRole('button', { name: 'Inject Context & Bypass' }).click();

        await page.waitForURL('**/master');

        const storedUser = await page.evaluate(() => {
            const raw = localStorage.getItem('master_ai_user');
            return raw ? JSON.parse(raw) : null;
        });

        expect(storedUser).toBeTruthy();
        expect(storedUser.email).toBe('ceo.maya.verma@example.com');
        expect(storedUser.tenant_id).toBe('ceo_maya_verma_example_com');
        expect(storedUser.tenantId).toBe('ceo_maya_verma_example_com');
        expect(storedUser.profile_type).toBe('CEO');
    });
});
