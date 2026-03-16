import { expect } from '@playwright/test';

export const apiBaseUrl = 'http://localhost:3001';

export const setLocalUser = async (page, user) => {
    await page.addInitScript((payload) => {
        window.localStorage.setItem('master_ai_user', JSON.stringify(payload));
        window.localStorage.setItem('pg_developer_mode', 'true');
    }, user);
};

export const bootstrapTenant = async (request, { email, name, intent = 'signup' }) => {
    const response = await request.post(`${apiBaseUrl}/api/auth/bootstrap`, {
        headers: { 'X-Actor-Email': email },
        data: { intent, email, name, picture: null },
    });
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.success).toBeTruthy();
    return json.data;
};

export const verifyCeoPhone = async (request, { tenantId, email, phone }) => {
    const startResponse = await request.post(`${apiBaseUrl}/api/auth/ceo-phone/start`, {
        headers: {
            'X-Actor-Email': email,
            'X-Tenant-ID': tenantId,
        },
        data: { phone },
    });
    if (!startResponse.ok()) {
        const startText = await startResponse.text();
        throw new Error(`ceo-phone/start failed (${startResponse.status()}): ${startText}`);
    }
    const startJson = await startResponse.json();
    expect(startJson.success).toBeTruthy();
    const otp = startJson.data?.dev_otp;
    expect(otp).toBeTruthy();

    const verifyResponse = await request.post(`${apiBaseUrl}/api/auth/ceo-phone/verify`, {
        headers: {
            'X-Actor-Email': email,
            'X-Tenant-ID': tenantId,
        },
        data: { otp },
    });
    if (!verifyResponse.ok()) {
        const verifyText = await verifyResponse.text();
        throw new Error(`ceo-phone/verify failed (${verifyResponse.status()}): ${verifyText}`);
    }
    const verifyJson = await verifyResponse.json();
    expect(verifyJson.success).toBeTruthy();
    return verifyJson.data;
};
