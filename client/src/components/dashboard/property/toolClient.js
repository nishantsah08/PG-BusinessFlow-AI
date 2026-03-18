import { apiClient } from '../../../api/client';

export const getTenantIdFromLocalUser = () => {
    try {
        const rawUser = localStorage.getItem('master_ai_user');
        if (!rawUser) return '';
        const user = JSON.parse(rawUser);
        const deriveTenantFromEmail = (value) => {
            if (typeof value !== 'string') return '';
            const normalizedEmail = value.trim().toLowerCase();
            if (!normalizedEmail.endsWith('@example.com')) return '';
            return normalizedEmail.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        };

        const emailTenant = deriveTenantFromEmail(user?.email);
        if (emailTenant) return emailTenant;

        if (typeof user?.tenant_id === 'string' && user.tenant_id.trim()) {
            return String(user.tenant_id).trim();
        }
        if (typeof user?.tenantId === 'string' && user.tenantId.trim()) {
            return String(user.tenantId).trim();
        }
    } catch (_error) {
        // Local auth context is optional in mocked/test paths.
    }
    return '';
};

export const getDashboardApiHeaders = (forJson = false) => {
    const headers = {};
    if (forJson) headers['Content-Type'] = 'application/json';

    const tenantId = getTenantIdFromLocalUser();
    if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
    }

    try {
        const rawUser = localStorage.getItem('master_ai_user');
        if (rawUser) {
            const user = JSON.parse(rawUser);
            if (user?.idToken) {
                headers.Authorization = `Bearer ${user.idToken}`;
            }
            if (user?.email) {
                headers['X-Actor-Email'] = String(user.email).toLowerCase();
            }
        }
    } catch (_error) {
        // Local auth context is optional in mocked/test paths.
    }

    return headers;
};

export const parseToolResponse = async (response) => {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
        if (response.status !== 200 || payload.success === false) {
            throw new Error(payload.error || `Tool call failed with status ${response.status}`);
        }
        return payload;
    }
    if (!response.ok) {
        throw new Error(payload?.error || `Tool call failed with status ${response.status}`);
    }
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return { success: true, data: payload.data };
    }
    return { success: true, data: payload };
};

export const executeDashboardTool = async (agentName, toolName, parameters = {}) => {
    const tenantId = getTenantIdFromLocalUser();
    const body = {
        agent_name: agentName,
        tool_name: toolName,
        parameters
    };

    if (tenantId) {
        body.tenant_id = tenantId;
    }

    const response = await apiClient.post('/api/master_ai/tools/execute', body);
    if (!response.success) {
        throw new Error(response.error || 'Tool call failed');
    }
    return { success: true, data: response.data };
};
