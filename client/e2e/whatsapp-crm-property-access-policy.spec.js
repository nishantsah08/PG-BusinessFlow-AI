import { test, expect } from '@playwright/test';

const apiBaseUrl = 'http://localhost:3001';
const tenantId = 'default';
const ceoEmail = 'nishantsah@outlook.in';

const executeTool = async (request, agentName, toolName, parameters) => {
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
    return json.data;
};

const clearThread = async (request, phone) => {
    const response = await request.delete(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`);
    expect(response.ok()).toBeTruthy();
};

const sendWhatsApp = async (request, phone, body) => {
    const response = await request.post(`${apiBaseUrl}/api/simulator/whatsapp/send`, {
        data: { from: phone, body },
    });
    expect(response.ok()).toBeTruthy();
};

const getThread = async (request, phone) => {
    const response = await request.get(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`);
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.success).toBeTruthy();
    return Array.isArray(json.data?.items) ? json.data.items : [];
};

const waitForOutboundReply = async (request, phone) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const items = await getThread(request, phone);
        const outbound = [...items].reverse().find((item) => item.direction === 'outbound');
        if (outbound?.body) {
            return outbound.body;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No outbound WhatsApp reply found for ${phone}`);
};

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

test.describe('WhatsApp CRM and Property access policy', () => {
    test('enforces CEO, staff, and customer role paths across CRM and Property', async ({ request }) => {
        test.setTimeout(240000);
        const stamp = Date.now();

        const ceoPhone = '+919822223333';
        const staffPhone = `+918404${String(stamp).slice(-6)}`;
        const crmCustomerPhone = '+919811112222';
        const propertyCustomerPhone = '+919800098000';
        const crmCustomerName = 'Neha Gupta';

        await executeTool(request, 'CRMAgent', 'update_lead_snapshot', {
            lead_id: ceoPhone,
            name: `WA CEO ${stamp}`,
            email: ceoEmail,
            profile_type: 'CEO',
        });

        const hiredStaff = await executeTool(request, 'HRAgent', 'hire_staff', {
            name: `Ops Staff ${stamp}`,
            designation: 'Caretaker',
            compensation_profile: 'caretaker',
            contact: {
                primary: staffPhone,
                email: `ops.staff.${stamp}@example.com`,
            },
            job_description: `Policy test staff ${stamp}`,
        });
        expect(hiredStaff.staff_id).toBeTruthy();

        await clearThread(request, ceoPhone);
        await clearThread(request, staffPhone);
        await clearThread(request, crmCustomerPhone);
        await clearThread(request, propertyCustomerPhone);

        await sendWhatsApp(request, ceoPhone, 'In CRM, tell me Amit Sharma primary phone.');
        const ceoCrmReply = await waitForOutboundReply(request, ceoPhone);
        expect(ceoCrmReply).toContain('Amit Sharma');
        expect(ceoCrmReply).toContain('+919800098000');

        await clearThread(request, staffPhone);
        await sendWhatsApp(request, staffPhone, 'In CRM, tell me Amit Sharma primary phone.');
        const staffCrmReadReply = await waitForOutboundReply(request, staffPhone);
        expect(staffCrmReadReply).toContain('Amit Sharma');
        expect(staffCrmReadReply).toContain('+919800098000');

        await clearThread(request, staffPhone);
        await sendWhatsApp(
            request,
            staffPhone,
            `In CRM, change the lead with phone ${crmCustomerPhone} status to Onboarded because agreement confirmed.`
        );
        const staffCrmUpdateReply = await waitForOutboundReply(request, staffPhone);
        expect(staffCrmUpdateReply).toMatch(/onboarded|updated|status/i);

        const updatedCustomer = await executeTool(request, 'CRMAgent', 'get_lead_by_phone', {
            phone: crmCustomerPhone,
        });
        expect(updatedCustomer.status).toBe('Found');
        expect(updatedCustomer.lead?.status).toBe('Onboarded');

        await sendWhatsApp(request, crmCustomerPhone, 'In CRM, tell me Amit Sharma primary phone and current status.');
        const customerCrmDeniedReply = await waitForOutboundReply(request, crmCustomerPhone);
        expect(customerCrmDeniedReply).not.toContain('+919800098000');
        expect(customerCrmDeniedReply).toMatch(/can't access|cannot access|unable|my profile|your profile|your details|your lead|let me know|feel free to ask/i);

        await clearThread(request, crmCustomerPhone);
        await sendWhatsApp(request, crmCustomerPhone, 'In CRM, tell me my own name and current status.');
        const customerCrmSelfReply = await waitForOutboundReply(request, crmCustomerPhone);
        expect(customerCrmSelfReply).toMatch(/onboarded|status/i);
        expect(customerCrmSelfReply).not.toContain('+919800098000');

        await clearThread(request, ceoPhone);
        const liveProperties = await executeTool(request, 'PropertyAI', 'get_properties', {});
        const targetProperty = Array.isArray(liveProperties)
            ? liveProperties.find((property) => property?.id && property?.name) || liveProperties.find((property) => property?.name) || null
            : null;
        expect(targetProperty?.name).toBeTruthy();
        const targetPropertyId = targetProperty?.id || targetProperty?.property_id;
        expect(targetPropertyId).toBeTruthy();
        await sendWhatsApp(request, ceoPhone, `In Property, tell me the exact property name for id ${targetPropertyId}.`);
        const ceoPropertyReply = await waitForOutboundReply(request, ceoPhone);
        expect(normalizeText(ceoPropertyReply).includes(normalizeText(targetProperty.name))).toBe(true);

        await clearThread(request, staffPhone);
        const liveAvailableUnits = await executeTool(request, 'PropertyAI', 'get_units', { status: 'AVAILABLE' });
        const targetUnit = Array.isArray(liveAvailableUnits) ? liveAvailableUnits[0] : null;
        expect(targetUnit?.id).toBeTruthy();
        await sendWhatsApp(
            request,
            staffPhone,
            `In Property, update ${targetUnit.id} (${targetUnit.unit_number}) status to BOOKED.`
        );
        const staffPropertyDeniedReply = await waitForOutboundReply(request, staffPhone);
        expect(staffPropertyDeniedReply).not.toMatch(/status updated|booked successfully|unit updated/i);

        const untouchedUnit = await executeTool(request, 'PropertyAI', 'get_units', { unit_id: targetUnit.id });
        expect(untouchedUnit.status).toBe(targetUnit.status);

        const refreshedUnits = await executeTool(request, 'PropertyAI', 'get_units', { status: 'AVAILABLE' });
        const visibleAvailableUnit = Array.isArray(refreshedUnits)
            ? refreshedUnits.find((unit) => unit.id !== targetUnit.id) || refreshedUnits[0]
            : null;

        await clearThread(request, propertyCustomerPhone);
        await sendWhatsApp(
            request,
            propertyCustomerPhone,
            'In Property, list available unit numbers and the public pricing details.'
        );
        const customerPropertyReply = await waitForOutboundReply(request, propertyCustomerPhone);
        expect(customerPropertyReply).toMatch(/rate|rent|deposit|pricing|₹|rs/i);
        expect(customerPropertyReply).not.toContain('Neha Gupta');
    });
});
