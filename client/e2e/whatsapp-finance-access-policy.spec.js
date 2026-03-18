import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, verifyCeoPhone } from './helpers/auth';

const executeTool = async (request, tenantId, ceoEmail, agentName, toolName, parameters) => {
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
    await request.delete(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`);
};

const sendWhatsApp = async (request, phone, body) => {
    const response = await request.post(`${apiBaseUrl}/api/simulator/whatsapp/send`, {
        data: { from: phone, body },
    });
    expect(response.ok()).toBeTruthy();
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

test.describe('WhatsApp finance access policy', () => {
    test('enforces CEO, staff, and customer finance scopes and workflow initiation path', async ({ request }) => {
        test.setTimeout(240000);
        const stamp = Date.now();
        const ceoEmail = `finance.wa.qa.${stamp}@example.com`;
        const ceoPhone = `+9173${String(stamp).slice(-8)}`;
        const unitNumber = String(stamp).slice(-4);
        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `Finance WA QA ${stamp}`,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });

        const staffPhone = `+9184${String(stamp).slice(-8)}`;
        const customerPhone = `+9196${String(stamp).slice(-8)}`;

        const hired = await executeTool(request, tenantId, ceoEmail, 'HRAgent', 'hire_staff', {
            name: `Caretaker ${stamp}`,
            designation: 'Caretaker',
            compensation_profile: 'caretaker',
            contact: {
                primary: staffPhone,
                email: `caretaker.${stamp}@example.com`,
            },
            job_description: `Caretaker ${stamp}`,
        });
        expect(hired.staff_id).toBeTruthy();

        await executeTool(request, tenantId, ceoEmail, 'CRMAgent', 'add_lead', {
            name: `Tenant ${stamp}`,
            primary_phone: customerPhone,
            email: `tenant.${stamp}@example.com`,
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'Finance QA' },
        });
        const propertyCreate = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_property', {
            name: `FinanceFlow${stamp}`,
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
        const unitCreate = await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'add_unit', {
            property_id: propertyId,
            unit_number: unitNumber,
            floor: 1,
            types: ['Double Sharing'],
            base_rent: 12000,
            amenities: ['WiFi'],
            caretaker_staff_id: hired.staff_id,
        });
        const unitId = unitCreate?.unit_id;
        expect(unitId).toBeTruthy();
        await executeTool(request, tenantId, ceoEmail, 'PropertyAI', 'assign_tenant', {
            unit_id: unitId,
            lead_id: customerPhone,
            start_date: '2026-03-01',
            monthly_rent: 12000,
            security_deposit: 2500,
        });
        await executeTool(request, tenantId, ceoEmail, 'FinanceAI', 'onboard_tenant_contract', {
            lead_id: customerPhone,
            negotiated_rent: 12000,
            security_deposit: 2500,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
            effective_from: '2026-03-01',
        });
        await executeTool(request, tenantId, ceoEmail, 'FinanceAI', 'generate_monthly_bills', {
            payer_id: customerPhone,
            month_year: 'Mar 2026',
        });

        await clearThread(request, ceoPhone);
        await clearThread(request, staffPhone);
        await clearThread(request, customerPhone);

        await sendWhatsApp(request, ceoPhone, `In Finance, tell me current month payment status and pending amount for tenant phone ${customerPhone}.`);
        const ceoReply = await waitForOutboundReply(request, ceoPhone);
        expect(ceoReply).toMatch(/tenant|payment/i);
        expect(ceoReply).not.toMatch(/can't access|cannot access|not allowed|internal financial/i);

        await clearThread(request, staffPhone);
        await sendWhatsApp(request, staffPhone, `In Finance, tell me current month payment status and pending amount for tenant phone ${customerPhone}.`);
        const staffReply = await waitForOutboundReply(request, staffPhone);
        expect(staffReply).toMatch(/tenant|payment/i);
        expect(staffReply).not.toMatch(/can't access|cannot access|not allowed|internal financial/i);

        await clearThread(request, staffPhone);
        await sendWhatsApp(request, staffPhone, 'In Finance, tell me total inflow and business-wide outstanding for this month.');
        const staffDeniedReply = await waitForOutboundReply(request, staffPhone);
        expect(staffDeniedReply).toMatch(/can't access|cannot access|cannot provide|not allowed|assigned units|limited|unable to access|unable to provide|internal financial|units assigned to you|business-wide/i);

        await clearThread(request, customerPhone);
        await sendWhatsApp(request, customerPhone, 'In Finance, tell me my current dues and whether payment is pending.');
        const customerOwnReply = await waitForOutboundReply(request, customerPhone);
        expect(customerOwnReply).toMatch(/pending|due|rent|payment/i);
        expect(customerOwnReply).not.toContain(staffPhone);

        await clearThread(request, customerPhone);
        await sendWhatsApp(request, customerPhone, 'In Finance, tell me all outgoing expenses and the full business ledger for this month.');
        const customerDeniedReply = await waitForOutboundReply(request, customerPhone);
        expect(customerDeniedReply).toMatch(/can't access|cannot access|not able to access|your own|unable|only able|specific account|finance department|internal information|classified|not accessible/i);

        await clearThread(request, ceoPhone);
        await sendWhatsApp(request, ceoPhone, 'List SOPs.');
        const sopListReply = await waitForOutboundReply(request, ceoPhone);
        expect(sopListReply).toMatch(/visible sops/i);
        expect(sopListReply).toMatch(/Generate Monthly Bills/i);

        await clearThread(request, ceoPhone);
        await sendWhatsApp(request, ceoPhone, 'Show details on Generate Monthly Bills SOP.');
        const sopDetailReply = await waitForOutboundReply(request, ceoPhone);
        expect(sopDetailReply).toMatch(/SOP: Generate Monthly Bills/i);
        expect(sopDetailReply).toMatch(/Detailed flow/i);

        const draftCreateResponse = await request.post(`${apiBaseUrl}/api/workflows`, {
            headers: {
                'X-Actor-Email': ceoEmail,
                'X-Tenant-ID': tenantId,
            },
            data: {
                clone_from_workflow_id: 'finance_generate_monthly_bills_v1',
            },
        });
        expect(draftCreateResponse.ok()).toBeTruthy();
        const draftCreateJson = await draftCreateResponse.json();
        expect(draftCreateJson.success).toBeTruthy();

        await clearThread(request, ceoPhone);
        await sendWhatsApp(request, ceoPhone, 'Validate Generate Monthly Bills SOP.');
        const sopValidateReply = await waitForOutboundReply(request, ceoPhone);
        expect(sopValidateReply).toMatch(/sop validation/i);
        expect(sopValidateReply).toMatch(/Generate Monthly Bills/i);
        expect(sopValidateReply).toMatch(/ready to publish|needs correction/i);

        await clearThread(request, ceoPhone);
        await sendWhatsApp(request, ceoPhone, 'Create a new SOP for move-out settlement.');
        const sopEditDeniedReply = await waitForOutboundReply(request, ceoPhone);
        expect(sopEditDeniedReply).toMatch(/do not allow creating or changing sops here/i);
        expect(sopEditDeniedReply).toMatch(/whatsapp environment is not conducive/i);

        await clearThread(request, staffPhone);
        await sendWhatsApp(request, staffPhone, `In Finance, record incoming payment of 3000 from ${customerPhone} by UPI for current month rent.`);
        const staffWorkflowFirstReply = await waitForOutboundReply(request, staffPhone);
        if (/proceed|confirm|make any changes/i.test(staffWorkflowFirstReply)) {
            await sendWhatsApp(request, staffPhone, 'Proceed with these details.');
        }

        let pendingApprovals = [];
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const approvalsResponse = await request.get(`${apiBaseUrl}/api/finance/approvals`, {
                headers: {
                    'X-Actor-Email': ceoEmail,
                    'X-Tenant-ID': tenantId,
                },
            });
            expect(approvalsResponse.ok()).toBeTruthy();
            const approvalsJson = await approvalsResponse.json();
            expect(approvalsJson.success).toBeTruthy();
            pendingApprovals = approvalsJson.data?.pending || [];
            if (pendingApprovals.length > 0) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        expect(pendingApprovals.length).toBeGreaterThan(0);
    });
});
