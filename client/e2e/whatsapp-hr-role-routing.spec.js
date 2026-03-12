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

test.describe('WhatsApp HR role routing', () => {
    test('CEO sees HR roster, staff sees only own details, customer gets nothing', async ({ request }) => {
        test.setTimeout(180000);
        const stamp = Date.now();

        const ceoPhone = '+919822223333';
        const staffPhone = `+918202${String(stamp).slice(-6)}`;
        const customerPhone = '+919800098000';

        const staffName = `WA Staff ${stamp}`;
        const customerName = 'Amit Sharma';

        const ceoLead = await executeTool(request, 'CRMAgent', 'update_lead_snapshot', {
            lead_id: ceoPhone,
            name: `WA CEO ${stamp}`,
            email: ceoEmail,
            profile_type: 'CEO',
        });
        expect(ceoLead.lead_id).toBeTruthy();

        const hiredStaff = await executeTool(request, 'HRAgent', 'hire_staff', {
            name: staffName,
            designation: 'Caretaker',
            compensation_profile: 'caretaker',
            contact: {
                primary: staffPhone,
                email: `wa.staff.${stamp}@example.com`,
            },
            job_description: `WhatsApp HR role-path staff ${stamp}`,
        });
        expect(hiredStaff.staff_id).toBeTruthy();

        await clearThread(request, ceoPhone);
        await clearThread(request, staffPhone);
        await clearThread(request, customerPhone);

        await sendWhatsApp(request, ceoPhone, 'List the current active staff members with their primary phone numbers.');
        const ceoReply = await waitForOutboundReply(request, ceoPhone);
        expect(ceoReply).toContain(staffName);
        expect(ceoReply).toContain(staffPhone);

        await sendWhatsApp(request, staffPhone, 'Give my own HR details only: my name, designation, and primary phone.');
        const staffReply = await waitForOutboundReply(request, staffPhone);
        expect(staffReply).toContain(staffName);
        expect(staffReply).toContain('Caretaker');
        expect(staffReply).toContain(staffPhone);
        expect(staffReply).not.toContain(customerPhone);
        expect(staffReply).not.toContain(customerName);

        await sendWhatsApp(request, customerPhone, 'List the current active staff members with their primary phone numbers.');
        const customerReply = await waitForOutboundReply(request, customerPhone);
        expect(customerReply).not.toContain(staffName);
        expect(customerReply).not.toContain(staffPhone);
        expect(customerReply).toMatch(/cannot|can't|unable|not authorized|don't have access|internal staff|not able/i);
    });
});
