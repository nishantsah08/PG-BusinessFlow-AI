import { test, expect } from '@playwright/test';

test.describe('Top-level modules', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('master_ai_user', JSON.stringify({
                email: 'qa-top-level@test.local',
                name: 'Top Level QA',
                type: 'Bypass'
            }));
            localStorage.setItem('pg_developer_mode', 'true');
        });

        await page.route('**/api/auth/context', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        email: 'qa-top-level@test.local',
                        profile_type: 'Staff',
                        permissions: {
                            admin_adapter: {
                                CommunicationsAI: [],
                                HRAgent: [
                                    'get_all_staff',
                                    'get_salary_card',
                                    'hire_staff',
                                    'update_staff_profile',
                                    'create_salary_card',
                                    'update_salary_card'
                                ],
                                FinanceAI: [
                                    'get_incoming_txns',
                                    'get_expenses'
                                ],
                                CRMAgent: [],
                                PropertyAI: []
                            }
                        }
                    }
                })
            });
        });

        await page.route('**/api/master_ai/tools/execute', async (route) => {
            const body = route.request().postDataJSON() || {};
            const tool = body.tool_name;
            let data = {};

            if (tool === 'get_all_staff') {
                data = [{
                    id: 'STF-01',
                    name: 'Ramesh Kumar',
                    designation: 'Property Manager',
                    job_description: 'Ops',
                    contact: { primary: '+919833334444', email: 'ramesh@pgflow.ai' },
                    status: 'ACTIVE'
                }];
            } else if (tool === 'get_salary_card') {
                data = {
                    staff_id: 'STF-01',
                    base_salary: 4000,
                    bank_details: {
                        account_holder: 'Ramesh Kumar',
                        account_number: '1234567890',
                        ifsc: 'HDFC0001234',
                        bank_name: 'HDFC Bank',
                        upi_id: 'ramesh@hdfcbank'
                    },
                    components: {
                        incentives: { logic: 'Units * Amount', amount_per_unit: 350 },
                        allowances: { travel: 1000, phone: 500 }
                    }
                };
            } else if (tool === 'get_incoming_txns') {
                data = { transactions: [{ txn_id: 'IN-1', payer_id: '+919800098000', amount: 12000, date: '2026-03-01', payment_mode: 'UPI', status: 'SUCCESS' }] };
            } else if (tool === 'get_expenses') {
                data = { transactions: [{ txn_id: 'OUT-1', category: 'OpEx', payee: 'Vendor', amount: 1500, property_id: 'PROP-1', date: '2026-03-01', payment_mode: 'UPI', status: 'SUCCESS' }] };
            } else {
                data = { status: 'OK' };
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data })
            });
        });
    });

    test('navigates to HR and Finance as first-class modules', async ({ page }) => {
        await page.goto('/master');

        await expect(page.getByRole('link', { name: 'HR' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Finance' })).toBeVisible();

        await page.getByRole('link', { name: 'HR' }).click();
        await expect(page.getByRole('heading', { name: 'HR Operations' })).toBeVisible();
        await expect(page.getByTestId('hr-employee-list-section')).toBeVisible();
        await expect(page.getByTestId('hr-add-employee-section')).toBeVisible();
        await expect(page.getByTestId('hr-edit-employee-section')).toBeVisible();
        await expect(page.getByTestId('hr-rate-card-section')).toBeVisible();
        await expect(page.getByPlaceholder('Employee name')).toHaveCount(0);
        await page.getByRole('button', { name: 'Add Employee' }).click();
        await expect(page.getByPlaceholder('Employee name')).toBeVisible();
        await page.getByRole('button', { name: 'Close Add Employee Modal' }).click();
        await page.getByRole('button', { name: 'Edit Employee' }).click();
        await expect(page.getByPlaceholder('Designation')).toBeVisible();
        await page.getByRole('button', { name: 'Close Edit Employee Modal' }).click();
        await page.getByRole('button', { name: 'Edit Rate Card' }).click();
        await expect(page.getByPlaceholder('Base salary')).toBeVisible();
        await page.getByRole('button', { name: 'Close Rate Card Modal' }).click();

        await page.getByRole('link', { name: 'Finance' }).click();
        await expect(page.getByRole('heading', { name: 'Finance Operations' })).toBeVisible();
        await expect(page.getByTestId('finance-overview-section')).toBeVisible();
        await page.getByRole('button', { name: 'Incoming' }).click();
        await expect(page.getByTestId('finance-incoming-section')).toBeVisible();
        await page.getByRole('button', { name: 'Outgoing' }).click();
        await expect(page.getByTestId('finance-outgoing-section')).toBeVisible();
    });
});
