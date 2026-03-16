import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, setLocalUser, verifyCeoPhone } from './helpers/auth';

const executeTool = async (request, tenantId, actorEmail, agentName, toolName, parameters) => {
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
    return json.data;
};

test.describe('Finance booking hold linked unit live', () => {
    test('records linked unit on booking hold and updates to final unit on onboarding', async ({ page, request }) => {
        test.setTimeout(240000);

        const stamp = Date.now();
        const ceoEmail = `finance.linked.unit.${stamp}@example.com`;
        const ceoPhone = `+9176${String(stamp).slice(-8)}`;
        const propertyName = `Linked Unit ${stamp}`;
        const firstUnitNumber = String(stamp).slice(-4);
        const finalUnitNumber = String(Number(firstUnitNumber) + 1);
        const bookingLeadPhone = `+9196${String(stamp).slice(-8)}`;

        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `Linked Unit QA ${stamp}`,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });

        await executeTool(request, tenantId, ceoEmail, 'CRMAgent', 'add_lead', {
            name: `Booking Lead ${stamp}`,
            primary_phone: bookingLeadPhone,
            email: `booking.linked.${stamp}@example.com`,
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'Linked unit test' },
        });

        const propertyCreate = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_property', {
            name: propertyName,
            address: '12 Lake View Road, Pune',
            pin_code: '411014',
            area: 'Viman Nagar',
            city: 'Pune',
            state: 'Maharashtra',
            amenities: ['WiFi'],
            floors: 3,
        });
        const propertyId = propertyCreate?.property_id;
        expect(propertyId).toBeTruthy();

        const firstUnit = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_unit', {
            property_id: propertyId,
            unit_number: firstUnitNumber,
            floor: 1,
            types: ['Double Sharing'],
            base_rent: 12000,
            amenities: ['WiFi'],
        });
        const finalUnit = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_unit', {
            property_id: propertyId,
            unit_number: finalUnitNumber,
            floor: 1,
            types: ['Single Room'],
            base_rent: 12500,
            amenities: ['WiFi'],
        });

        expect(firstUnit?.unit_id).toBeTruthy();
        expect(finalUnit?.unit_id).toBeTruthy();

        await setLocalUser(page, {
            email: ceoEmail,
            name: `Linked Unit QA ${stamp}`,
            tenant_id: tenantId,
            tenantId,
            profile_type: 'CEO',
            type: 'Bypass',
        });

        await page.goto('/finance');
        await expect(page.getByRole('heading', { name: 'Controlled finance workflows' })).toBeVisible();
        await page.getByRole('button', { name: 'Incoming' }).click();

        await page.getByRole('button', { name: 'Record Booking Hold' }).click();
        await expect(page.getByRole('heading', { name: 'Record Booking Hold' })).toBeVisible();
        await page.getByLabel('Payer / Lead').fill(bookingLeadPhone);
        await page.getByLabel('Linked Property for Booking Hold').selectOption(propertyId);
        await page.getByLabel('Linked Unit for Booking Hold').selectOption(firstUnit.unit_id);
        await page.getByLabel('Booking Amount').fill('5000');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();

        await expect(page.getByTestId('finance-incoming-tab')).toContainText(bookingLeadPhone, { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(firstUnitNumber, { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText('ACTIVE', { timeout: 15000 });

        await page.getByRole('button', { name: 'Complete Onboarding' }).click();
        await expect(page.getByRole('heading', { name: 'Complete Onboarding From Booking' })).toBeVisible();
        await page.getByLabel('Booking Hold').selectOption({ index: 1 });
        await page.getByLabel('Assigned Unit').selectOption(finalUnit.unit_id);
        await page.getByLabel('Onboarding Date').fill('2026-03-21');
        await page.getByLabel('Negotiated Rent').fill('12500');
        await page.getByLabel('Security Deposit').fill('5000');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();

        await expect(page.getByTestId('finance-incoming-tab')).toContainText('APPLIED_ON_ONBOARDING', { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(finalUnitNumber, { timeout: 15000 });
    });
});
