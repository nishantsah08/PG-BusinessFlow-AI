import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, verifyCeoPhone } from './helpers/auth';

const executeTool = async (request, apiBaseUrl, tenantId, ceoEmail, agentName, toolName, parameters) => {
    const response = await request.post(`${apiBaseUrl}/api/master_ai/tools/execute`, {
        headers: {
            'X-Actor-Email': ceoEmail,
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

test.describe('HR live guardrails', () => {
    test('blocks invalid operator actions and keeps system state aligned', async ({ page, request }) => {
        test.setTimeout(180000);
        const stamp = Date.now();
        const ceoEmail = `hr.gui.guardrails.${stamp}@example.com`;
        const ceoPhone = `+9176${String(stamp).slice(-8)}`;
        const validName = `HR Guardrails ${stamp}`;
        const validPhone = `+9186${String(stamp).slice(-8)}`;
        const validEmail = `staff.guardrails.${stamp}@example.com`;
        const invalidPhone = '5465';

        console.log('guardrails: bootstrap signup');
        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `HR Guardrails ${stamp}`,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });

        await page.addInitScript(({ email, tenantId, name }) => {
            window.localStorage.setItem('master_ai_user', JSON.stringify({
                email,
                name,
                tenant_id: tenantId,
                tenantId,
                profile_type: 'CEO',
                type: 'Bypass',
            }));
        }, { email: ceoEmail, tenantId, name: `HR Guardrails ${stamp}` });

        await page.goto('/hr');
        await expect(page.getByRole('heading', { name: 'People and compensation' })).toBeVisible();
        console.log('guardrails: hr page loaded');

        await page.getByRole('button', { name: 'Add Employee' }).click();
        await page.getByRole('button', { name: 'Save Employee' }).click();
        await expect(page.getByText('Name and primary contact are required for caretaker hire.')).toBeVisible();
        console.log('guardrails: required add fields enforced');

        await page.getByPlaceholder('Employee name').fill(validName);
        await page.getByPlaceholder('Primary phone').fill(invalidPhone);
        await page.getByRole('button', { name: 'Save Employee' }).click();
        await expect(page.getByText('Invalid phone number format provided in contacts')).toBeVisible();
        console.log('guardrails: invalid phone blocked');

        const staffAfterInvalidHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        expect(Array.isArray(staffAfterInvalidHireJson.data)).toBeTruthy();
        expect(staffAfterInvalidHireJson.data).toHaveLength(0);

        const crmAfterInvalidHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'CRMAgent',
            'get_lead_by_phone',
            { phone: invalidPhone }
        );
        expect(crmAfterInvalidHireJson.data?.status).toBe('Invalid Input');
        console.log('guardrails: invalid hire did not leak into hr/crm');

        await page.getByPlaceholder('Primary phone').fill(validPhone);
        await page.getByPlaceholder('Email').fill(validEmail);
        await page.getByPlaceholder('Job description').fill(`Guardrails onboarding ${stamp}`);
        await page.getByRole('button', { name: 'Save Employee' }).click();
        await expect(page.getByPlaceholder('Employee name')).toHaveCount(0);
        await expect(page.locator('[data-testid="hr-people-roster"]')).toContainText(validName);
        console.log('guardrails: valid hire completed');

        await page.getByPlaceholder('Search people').fill(validPhone);
        await page.locator('[data-testid="hr-people-roster"] button').filter({ hasText: validPhone }).first().click();
        await expect(page.getByRole('button', { name: 'Terminate' })).toBeVisible();
        console.log('guardrails: employee selected');

        const staffAfterValidHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        const hiredStaff = Array.isArray(staffAfterValidHireJson.data)
            ? staffAfterValidHireJson.data.find((person) => person.contact?.primary === validPhone)
            : null;
        expect(hiredStaff?.name).toBe(validName);
        console.log('guardrails: hr state after valid hire checked');

        const crmAfterValidHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'CRMAgent',
            'get_lead_by_phone',
            { phone: validPhone }
        );
        expect(crmAfterValidHireJson.data?.status).toBe('Found');
        console.log('guardrails: crm state after valid hire checked');

        await request.delete(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(validPhone)}`);
        const whatsappSend = await request.post(`${apiBaseUrl}/api/simulator/whatsapp/send`, {
            data: {
                from: validPhone,
                body: `HR guardrails ping ${stamp}`,
            },
        });
        expect(whatsappSend.ok()).toBeTruthy();
        const whatsappThread = await request.get(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(validPhone)}`);
        expect(whatsappThread.ok()).toBeTruthy();
        const whatsappThreadJson = await whatsappThread.json();
        expect(whatsappThreadJson.success).toBeTruthy();
        expect(Array.isArray(whatsappThreadJson.data?.items)).toBeTruthy();
        expect(whatsappThreadJson.data.items.length).toBeGreaterThanOrEqual(2);
        console.log(`guardrails: whatsapp items=${whatsappThreadJson.data.items.length}`);

        await page.getByRole('button', { name: 'Terminate' }).click();
        await page.getByRole('button', { name: 'Confirm Termination' }).click();
        await expect(page.getByText('Termination reason is required.')).toBeVisible();
        await expect(page.getByPlaceholder('Reason for termination')).toBeVisible();

        const staffAfterBlockedTerminationJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        const activeStaff = Array.isArray(staffAfterBlockedTerminationJson.data)
            ? staffAfterBlockedTerminationJson.data.find((person) => person.id === hiredStaff.id)
            : null;
        expect(activeStaff?.status).toBe('ACTIVE');
        console.log('guardrails: blank termination blocked');

        await page.getByPlaceholder('Reason for termination').fill(`Guardrails termination ${stamp}`);
        await page.locator('input[type="date"]').fill('2026-03-11');
        await page.getByRole('button', { name: 'Confirm Termination' }).click();
        await expect(page.getByPlaceholder('Reason for termination')).toHaveCount(0);
        await page.getByPlaceholder('Search people').fill(validPhone);
        await expect(page.locator('[data-testid="hr-people-roster"]')).not.toContainText(validPhone);
        await page.getByRole('combobox').selectOption('TERMINATED');
        await expect(page.locator('[data-testid="hr-people-roster"]')).toContainText(validPhone);

        const staffAfterTerminationJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        const terminatedStaff = Array.isArray(staffAfterTerminationJson.data)
            ? staffAfterTerminationJson.data.find((person) => person.id === hiredStaff.id)
            : null;
        expect(terminatedStaff?.status).toBe('TERMINATED');
        expect(terminatedStaff?.last_working_day).toBe('2026-03-11');
        console.log('guardrails: final termination completed');
    });
});
