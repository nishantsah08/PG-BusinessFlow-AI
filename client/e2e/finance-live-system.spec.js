import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, setLocalUser, verifyCeoPhone } from './helpers/auth';

const sampleArtifact = {
    name: 'payment-proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Bank proof UTR 1234567890', 'utf8'),
};

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

const waitForOutboundReply = async (request, phone) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await request.get(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`);
        expect(response.ok()).toBeTruthy();
        const json = await response.json();
        expect(json.success).toBeTruthy();
        const items = Array.isArray(json.data?.items) ? json.data.items : [];
        const outbound = [...items].reverse().find((item) => item.direction === 'outbound');
        if (outbound?.body) return outbound.body;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No outbound WhatsApp reply found for ${phone}`);
};

test.describe('Finance live system flow', () => {
    test('covers payer-first incoming, booking hold, onboarding, vendor accounting, and property/staff finance views', async ({ page, request }) => {
        test.setTimeout(300000);

        const stamp = Date.now();
        const ceoEmail = `finance.gui.qa.${stamp}@example.com`;
        const ceoPhone = `+9177${String(stamp).slice(-8)}`;
        const propertyName = `Sunrise ${stamp}`;
        const primaryUnitNumber = String(stamp).slice(-4);
        const onboardingUnitNumber = String(Number(String(stamp).slice(-4)) + 1);

        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `Finance GUI QA ${stamp}`,
        });
        console.log('[finance-live] tenant bootstrapped');
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });
        console.log('[finance-live] ceo verified');

        const hired = await executeTool(request, tenantId, ceoEmail, 'HRAgent', 'hire_staff', {
            name: `Caretaker ${stamp}`,
            designation: 'Caretaker',
            compensation_profile: 'caretaker',
            contact: {
                primary: `+9187${String(stamp).slice(-8)}`,
                email: `caretaker.${stamp}@example.com`,
            },
            job_description: `Caretaker ${stamp}`,
        });
        const staffRows = await executeTool(request, tenantId, ceoEmail, 'HRAgent', 'get_all_staff', {});
        const staff = Array.isArray(staffRows) ? staffRows.find((row) => row.id === hired.staff_id) : null;
        expect(staff?.id).toBeTruthy();
        console.log('[finance-live] staff hired');

        const existingCustomerPhone = `+9194${String(stamp).slice(-8)}`;
        const bookingLeadPhone = `+9195${String(stamp).slice(-8)}`;
        await executeTool(request, tenantId, ceoEmail, 'CRMAgent', 'add_lead', {
            name: `Tenant ${stamp}`,
            primary_phone: existingCustomerPhone,
            email: `tenant.${stamp}@example.com`,
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'Finance QA' },
        });
        await executeTool(request, tenantId, ceoEmail, 'CRMAgent', 'add_lead', {
            name: `Booking Lead ${stamp}`,
            primary_phone: bookingLeadPhone,
            email: `booking.${stamp}@example.com`,
            profile_type: 'Customer',
            source: { category: 'Reference', detail: 'Finance QA' },
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
        const primaryUnit = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_unit', {
            property_id: propertyId,
            unit_number: primaryUnitNumber,
            floor: 1,
            types: ['Double Sharing'],
            base_rent: 12000,
            amenities: ['WiFi'],
            caretaker_staff_id: staff.id,
        });
        const onboardingUnit = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_unit', {
            property_id: propertyId,
            unit_number: onboardingUnitNumber,
            floor: 1,
            types: ['Single Room'],
            base_rent: 12500,
            amenities: ['WiFi'],
            caretaker_staff_id: staff.id,
        });
        await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'assign_tenant', {
            unit_id: primaryUnit.unit_id,
            lead_id: existingCustomerPhone,
            start_date: '2026-03-01',
            monthly_rent: 12000,
            security_deposit: 2500,
        });
        await executeTool(request, tenantId, ceoEmail, 'FinanceAI', 'onboard_tenant_contract', {
            lead_id: existingCustomerPhone,
            unit_id: primaryUnit.unit_id,
            property_id: propertyId,
            negotiated_rent: 12000,
            security_deposit: 2500,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
            effective_from: '2026-03-01',
        });
        await executeTool(request, tenantId, ceoEmail, 'FinanceAI', 'generate_monthly_bills', {
            payer_id: existingCustomerPhone,
            month_year: 'Mar 2026',
        });
        console.log('[finance-live] base finance data prepared');

        await setLocalUser(page, {
            email: ceoEmail,
            name: `Finance GUI QA ${stamp}`,
            tenant_id: tenantId,
            tenantId,
            profile_type: 'CEO',
            type: 'Bypass',
        });

        await page.goto('/workflows');
        await expect(page.getByRole('heading', { name: 'SOPs' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Record Booking Hold')).toBeVisible();
        await expect(page.getByText('Onboard Tenant')).toBeVisible();
        await expect(page.getByText('Rent Collection')).toBeVisible();
        await expect(page.getByText('Record Outgoing Transaction')).toBeVisible();
        await expect(page.getByText('Offboard Tenant')).toBeVisible();
        await expect(page.getByText('Correct Finance Entry')).toBeVisible();
        await expect(page.getByText('Generate Monthly Bills')).toBeVisible();
        await expect(page.getByText('payment_acknowledgement')).toHaveCount(0);
        await expect(page.getByText('operations_send_month_end_itemized_bill_v1')).toHaveCount(0);
        await page.locator('xpath=//div[normalize-space()="Generate Monthly Bills"]/ancestor::div[.//button[normalize-space()="Open"]][1]//button[normalize-space()="Open"]').first().click();
        await expect(page.getByText('Business outcome')).toBeVisible();
        await expect(page.getByText('Who can initiate and approve')).toBeVisible();
        await expect(page.getByText('Failure and rollback policy')).toBeVisible();
        await expect(page.getByText("For the target month, create each tenant's bill using approved contract terms")).toBeVisible();
        await page.getByLabel('Close').click();
        console.log('[finance-live] sop workspace visible');

        await page.goto('/finance');
        await expect(page.getByRole('heading', { name: 'Controlled finance workflows' })).toBeVisible();
        await expect(page.getByText('Period')).toBeVisible();
        console.log('[finance-live] finance page visible');

        await page.getByRole('button', { name: 'Incoming' }).click();
        console.log('[finance-live] incoming tab opened');
        await expect(page.getByRole('button', { name: 'Add Incoming' })).toBeVisible({ timeout: 10000 });
        console.log('[finance-live] available buttons after incoming tab', await page.locator('button').allTextContents());

        await page.getByRole('button', { name: 'Add Incoming' }).click();
        await expect(page.getByRole('heading', { name: 'Record Incoming Payment' })).toBeVisible({ timeout: 10000 });
        console.log('[finance-live] incoming modal opened');
        await page.getByLabel('Payer / Tenant / Lead').fill(existingCustomerPhone);
        console.log('[finance-live] incoming payer filled');
        console.log('[finance-live] property options', await page.getByLabel('Linked Property').locator('option').allTextContents());
        await page.getByLabel('Linked Property').selectOption(propertyId);
        console.log('[finance-live] incoming property selected');
        console.log('[finance-live] unit options', await page.getByLabel('Linked Unit').locator('option').allTextContents());
        await page.getByLabel('Linked Unit').selectOption(primaryUnit.unit_id);
        console.log('[finance-live] incoming unit selected');
        await page.getByLabel('Amount').fill('12000');
        await page.getByLabel('Payment Mode').selectOption('UPI');
        await page.locator('input[type="file"]').first().setInputFiles(sampleArtifact);
        await expect(page.getByText('Uploading...')).toHaveCount(0);
        await page.getByLabel('Reference / Txn ID').fill(`UTR-${stamp}`);
        await page.getByLabel('Notes').fill('March payment received in one shot.');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(primaryUnitNumber, { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(existingCustomerPhone, { timeout: 15000 });
        console.log('[finance-live] incoming recorded');

        await page.getByRole('button', { name: 'Record Booking Hold' }).click();
        await page.getByLabel('Payer / Lead').fill(bookingLeadPhone);
        await page.getByLabel('Linked Property for Booking Hold').selectOption(propertyId);
        await page.getByLabel('Linked Unit for Booking Hold').selectOption(primaryUnit.unit_id);
        await page.getByLabel('Booking Amount').fill('5000');
        await page.getByLabel('Booking Hold Payment Mode').selectOption('UPI');
        await page.locator('input[type="file"]').first().setInputFiles(sampleArtifact);
        await expect(page.getByText('Uploading...')).toHaveCount(0);
        await page.getByLabel('Booking Hold Notes').fill('Hold this booking for the customer until move-in.');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(bookingLeadPhone, { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText('ACTIVE', { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(primaryUnitNumber, { timeout: 15000 });
        console.log('[finance-live] booking hold recorded');

        await page.getByRole('button', { name: 'Complete Onboarding' }).click();
        await page.getByLabel('Booking Hold').selectOption({ index: 1 });
        await page.getByLabel('Assigned Unit').selectOption(onboardingUnit.unit_id);
        await page.getByLabel('Onboarding Date').fill('2026-03-21');
        await page.getByLabel('Negotiated Rent').fill('12500');
        await page.getByLabel('Security Deposit').fill('5000');
        await page.getByLabel('Rent Payment Timing').selectOption('ADVANCE');
        await page.getByLabel('Utility Payment Timing').selectOption('ARREARS');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();
        await expect(page.getByTestId('finance-incoming-tab')).toContainText('APPLIED_ON_ONBOARDING', { timeout: 15000 });
        await expect(page.getByTestId('finance-incoming-tab')).toContainText(onboardingUnitNumber, { timeout: 15000 });
        console.log('[finance-live] onboarding from booking completed');

        const vendorPhone = `+9191${String(stamp).slice(-8)}`;
        await page.getByRole('button', { name: 'Vendors' }).click();
        await page.getByRole('button', { name: 'Add Vendor' }).click();
        await page.getByLabel('Vendor Name').fill(`Vendor ${stamp}`);
        await page.getByLabel('Vendor Category').selectOption('Maintenance');
        await page.getByLabel('Vendor Primary Phone').fill(vendorPhone);
        await page.getByLabel('Vendor Email').fill(`vendor.${stamp}@example.com`);
        await page.getByLabel('Vendor UPI ID').fill(`vendor${stamp}@upi`);
        await page.getByLabel('Vendor Bank Name').fill('HDFC Bank');
        await page.getByLabel('Vendor Account Holder').fill(`Vendor ${stamp}`);
        await page.getByLabel('Vendor Account Number').fill(`123456${String(stamp).slice(-6)}`);
        await page.getByLabel('Vendor IFSC').fill('HDFC0001234');
        await page.getByLabel('Vendor Notes').fill('Primary plumbing supplier.');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();
        await expect(page.getByTestId('finance-vendors-tab')).toContainText(`Vendor ${stamp}`, { timeout: 15000 });
        console.log('[finance-live] vendor added');

        await page.getByRole('button', { name: 'Outgoing' }).click();
        await page.getByRole('button', { name: 'Add Outgoing' }).click();
        await page.getByLabel('Outgoing Property').selectOption(propertyId);
        await page.getByLabel('Outgoing Unit').selectOption(primaryUnit.unit_id);
        await page.getByLabel('Outgoing Category').selectOption('OpEx');
        await page.getByLabel('Outgoing Sub-category').fill('Plumbing');
        await page.getByLabel('Work Title').fill('Unit plumbing repair');
        await page.getByLabel('Registered Vendor').fill(`Vendor ${stamp}`);
        await page.getByLabel('Work Done').fill('Current month plumbing repair');
        await page.getByLabel('Line Item 1 Name').fill('PVC Pipe');
        await page.getByLabel('Line Item 1 Quantity').fill('2');
        await page.getByLabel('Line Item 1 Unit Price').fill('900');
        await page.getByLabel('Outgoing Amount').fill('1800');
        await page.getByLabel('Outgoing Payment Mode').selectOption('UPI');
        await page.locator('input[type="file"]').first().setInputFiles(sampleArtifact);
        await expect(page.getByText('Uploading...')).toHaveCount(0);
        await page.getByLabel('Remarks').fill('Paid immediately after work completion.');
        await page.getByRole('button', { name: 'Submit Workflow' }).click();
        await expect(page.getByTestId('finance-outgoing-tab')).toContainText(`Vendor ${stamp}`, { timeout: 15000 });
        await expect(page.getByTestId('finance-outgoing-tab')).toContainText('Unit plumbing repair', { timeout: 15000 });
        console.log('[finance-live] outgoing recorded');

        await page.getByRole('button', { name: 'Vendors' }).click();
        await expect(page.getByTestId('finance-vendors-tab')).toContainText('INR 1,800');
        const vendorReply = await waitForOutboundReply(request, vendorPhone);
        expect(vendorReply).toMatch(/payment confirmation|thank you|recorded/i);
        console.log('[finance-live] vendor confirmation received');

        await page.getByRole('button', { name: 'Overview' }).click();
        await expect(page.getByText('Cash In Hand')).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Period' })).toHaveValue('CURRENT_MONTH');
        await expect(page.getByText('INR 15,200')).toBeVisible();
        console.log('[finance-live] finance snapshot refreshed with cash in hand');

        await page.getByRole('link', { name: 'Property & Booking' }).click();
        const propertyCardTitle = page.locator('h3', { hasText: propertyName }).first();
        await expect(propertyCardTitle).toBeVisible();
        await propertyCardTitle.click();
        await page.getByLabel(`Open actions for Unit ${primaryUnitNumber}`).click();
        await page.getByRole('button', { name: 'Current-Month Finance' }).click();
        await expect(page.getByRole('heading', { name: 'Current-Month Unit Finance' })).toBeVisible();
        await expect(page.getByText('Rent due')).toBeVisible();
        await expect(page.getByText('Deposit due')).toBeVisible();
        await expect(page.getByText('PAID').first()).toBeVisible();
        await page.getByLabel('Close Unit Finance Modal').click();
        console.log('[finance-live] property unit finance checked');

        await setLocalUser(page, {
            email: staff.contact.email,
            name: staff.name,
            tenant_id: tenantId,
            tenantId,
            profile_type: 'Staff',
            type: 'Bypass',
        });

        await page.goto('/finance');
        await expect(page.getByTestId('finance-assigned-units')).toContainText(`Unit ${primaryUnitNumber}`);
        await expect(page.getByTestId('finance-assigned-units')).toContainText('PAID');
        await expect(page.getByRole('button', { name: 'Incoming' })).toHaveCount(0);
        await expect(page.getByText('Finance snapshot')).toHaveCount(0);
        console.log('[finance-live] staff finance restrictions confirmed');
    });
});
