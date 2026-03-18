import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, setLocalUser } from './helpers/auth';

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
        const outbound = [...items].reverse().find((item) => item.direction === 'outbound' && !/OTP/i.test(item.body || ''));
        if (outbound?.body) return outbound.body;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No outbound WhatsApp reply found for ${phone}`);
};

test.describe('CEO activation flow', () => {
    test('forces phone verification before portal access and binds fresh CEO WhatsApp identity to the new tenant', async ({ page, request }) => {
        test.setTimeout(240000);
        const stamp = Date.now();
        const ceoEmail = `ceo.activation.${stamp}@example.com`;
        const ceoPhone = `+9172${String(stamp).slice(-8)}`;
        const customerPhone = `+9195${String(stamp).slice(-8)}`;

        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `CEO Activation ${stamp}`,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        console.log(`activation: tenant=${tenantId}`);

        const authContextResponse = await request.get(`${apiBaseUrl}/api/auth/context`, {
            headers: {
                'X-Actor-Email': ceoEmail,
                'X-Tenant-ID': tenantId,
            },
        });
        expect(authContextResponse.ok()).toBeTruthy();
        const authContextJson = await authContextResponse.json();
        console.log(`activation: authContext=${JSON.stringify(authContextJson.data || {})}`);

        const blockedResponse = await request.post(`${apiBaseUrl}/api/master_ai/tools/execute`, {
            headers: {
                'X-Actor-Email': ceoEmail,
                'X-Tenant-ID': tenantId,
            },
            data: {
                agent_name: 'CRMAgent',
                tool_name: 'get_recent_leads',
                parameters: { limit: 5 },
            },
        });
        expect(blockedResponse.status()).toBe(403);
        const blockedJson = await blockedResponse.json();
        expect(blockedJson.error).toMatch(/CEO phone verification/i);
        console.log('activation: pre-verification access blocked');

        await setLocalUser(page, {
            email: ceoEmail,
            name: `CEO Activation ${stamp}`,
            tenant_id: tenantId,
            tenantId,
            profile_type: 'CEO',
            type: 'Bypass',
        });

        await page.goto('/activate-ceo');
        await expect(page.getByRole('heading', { name: 'Verify the CEO phone before the workspace can go live.' })).toBeVisible();
        console.log('activation: verification gate visible');

        await page.getByLabel('CEO phone').fill(ceoPhone);
        await page.getByRole('button', { name: 'Send OTP' }).click();
        const otpHint = page.getByText(/Local verification code:/);
        await expect(otpHint).toBeVisible();
        console.log('activation: otp sent');
        const otpText = await otpHint.textContent();
        const otp = (otpText || '').match(/(\d{6})/)?.[1];
        expect(otp).toBeTruthy();

        await page.getByLabel('Enter OTP').fill(otp);
        await page.getByRole('button', { name: 'Verify and Activate' }).click();
        await expect
            .poll(async () => {
                const activeContextResponse = await request.get(`${apiBaseUrl}/api/auth/context`, {
                    headers: {
                        'X-Actor-Email': ceoEmail,
                        'X-Tenant-ID': tenantId,
                    },
                });
                if (!activeContextResponse.ok()) return 'http_error';
                const activeContextJson = await activeContextResponse.json();
                if (activeContextJson.data?.requires_ceo_phone_verification) return 'pending';
                return activeContextJson.data?.owner?.phone || 'missing';
            }, { timeout: 15000 })
            .toBe(ceoPhone);
        await page.goto('/overview');
        await expect(page).toHaveURL(/\/master$/);
        await expect(page.getByRole('heading', { name: 'MasterAI Interface' })).toBeVisible();
        console.log('activation: portal activated');

        await executeTool(request, tenantId, ceoEmail, 'CRMAgent', 'add_lead', {
            name: `Activation Tenant ${stamp}`,
            primary_phone: customerPhone,
            email: `tenant.${stamp}@example.com`,
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'CEO Activation' },
        });
        console.log('activation: crm lead seeded');

        await request.delete(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(ceoPhone)}`);
        await request.post(`${apiBaseUrl}/api/simulator/whatsapp/send`, {
            data: {
                from: ceoPhone,
                body: `In CRM, show the lead with phone ${customerPhone}.`,
            },
        });
        console.log('activation: whatsapp sent');

        const reply = await waitForOutboundReply(request, ceoPhone);
        console.log(`activation: whatsapp reply=${reply}`);
        expect(reply).toMatch(new RegExp(customerPhone.replace(/[+]/g, '\\$&')));
        expect(reply).not.toMatch(/can't access|cannot access|not allowed/i);
    });
});
