import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, verifyCeoPhone } from './helpers/auth';

const executeTool = async (request, apiBaseUrl, tenantId, actorEmail, agentName, toolName, parameters) => {
    const response = await request.post(`${apiBaseUrl}/api/master_ai/tools/execute`, {
        headers: {
            'X-Actor-Email': actorEmail,
            'X-Tenant-ID': tenantId,
        },
        data: {
            agent_name: agentName,
            tool_name: toolName,
            parameters,
        },
    });
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.success).toBeTruthy();
    return json;
};

test.describe('CRM live search and filters', () => {
    test('searches by phone/name/email and filters by status and profile in the live GUI', async ({ page, request }) => {
        test.setTimeout(180000);
        const stamp = Date.now();
        const ceoEmail = `crm.gui.qa.${stamp}@example.com`;
        const ceoPhone = `+9174${String(stamp).slice(-8)}`;
        const tenantName = `CRM GUI QA ${stamp}`;

        const staffLead = {
            name: `Priya Staff ${stamp}`,
            phone: `+9181${String(stamp).slice(-8)}`,
            email: `priya.${stamp}@example.com`,
            designation: 'Caretaker',
        };

        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: tenantName,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });

        await executeTool(request, apiBaseUrl, tenantId, ceoEmail, 'HRAgent', 'hire_staff', {
            name: staffLead.name,
            designation: staffLead.designation,
            contact: {
                primary: staffLead.phone,
                email: staffLead.email,
            },
        });
        await expect
            .poll(async () => {
                const crmLookup = await executeTool(request, apiBaseUrl, tenantId, ceoEmail, 'CRMAgent', 'get_lead_by_phone', {
                    phone: staffLead.phone,
                });
                return crmLookup.data?.status;
            }, { timeout: 15000 })
            .toBe('Found');
        const staffLookup = await executeTool(request, apiBaseUrl, tenantId, ceoEmail, 'CRMAgent', 'get_lead_by_phone', {
            phone: staffLead.phone,
        });
        expect(staffLookup.data?.lead?.profile_type).toBe('Staff');
        const customerOnlySnapshot = await executeTool(request, apiBaseUrl, tenantId, ceoEmail, 'CRMAgent', 'get_recent_leads', {
            limit: 100,
            profile_type: 'Customer',
        });
        expect(Array.isArray(customerOnlySnapshot.data?.leads) ? customerOnlySnapshot.data.leads : []).toHaveLength(0);
        const staffOnlySnapshot = await executeTool(request, apiBaseUrl, tenantId, ceoEmail, 'CRMAgent', 'get_recent_leads', {
            limit: 100,
            profile_type: 'Staff',
        });
        expect(staffOnlySnapshot.data?.leads?.[0]?.lead_id).toBe(staffLead.phone);

        await page.addInitScript(({ email, tenantId, tenantName }) => {
            window.localStorage.setItem('master_ai_user', JSON.stringify({
                email,
                name: tenantName,
                tenant_id: tenantId,
                tenantId,
                profile_type: 'CEO',
                type: 'Bypass',
            }));
        }, { email: ceoEmail, tenantId, tenantName });

        await page.goto('/crm');
        await page.getByTestId('crm-tab-leads').click();
        await expect(page.getByTestId('crm-console')).toBeVisible();

        const searchRow = page.getByTestId('crm-leads-search-row');
        await expect(searchRow.getByTestId('crm-search-input')).toHaveAttribute('placeholder', 'Search by phone / name / email');
        await expect(searchRow.locator('select')).toHaveCount(2);
        await expect(searchRow).not.toContainText('Source: All');
        await expect(page.getByTestId('crm-status-filter')).toHaveValue('ALL');
        await expect(page.getByTestId('crm-profile-filter')).toHaveValue('ALL');

        await page.getByTestId('crm-search-input').fill(staffLead.name);
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId(`crm-lead-${staffLead.phone}`)).toBeVisible();

        await page.getByTestId('crm-search-input').fill(staffLead.phone);
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId(`crm-lead-${staffLead.phone}`)).toBeVisible();

        await page.getByTestId('crm-search-input').fill(staffLead.email);
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId(`crm-lead-${staffLead.phone}`)).toBeVisible();

        await page.getByTestId('crm-search-input').fill('');
        await page.getByTestId('crm-profile-filter').selectOption('Staff');
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId(`crm-lead-${staffLead.phone}`)).toBeVisible();
        await expect(page.locator('[data-testid^="crm-lead-"]')).toHaveCount(1);

        await page.getByTestId('crm-profile-filter').selectOption('Customer');
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId(`crm-lead-${staffLead.phone}`)).toHaveCount(0);

        await page.getByTestId('crm-profile-filter').selectOption('Staff');
        await page.getByTestId('crm-status-filter').selectOption('Enquiry');
        await page.getByTestId('crm-search-input').fill(staffLead.email);
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId(`crm-lead-${staffLead.phone}`)).toBeVisible();
    });
});
