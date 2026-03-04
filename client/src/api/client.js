/**
 * Centralized API Client for PG-BusinessFlow.ai
 *
 * Requirements:
 * 1. All requests MUST go through this client.
 * 2. Requests allowed ONLY to /api/*
 * 3. Must attach request_id automatically
 * 4. Must measure latency
 * 5. Must normalize response to: { success, data, error, correlation_id, latency_ms }
 */

const generateRequestId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Standardized response formatter
 */
const formatResponse = (success, data, error, correlation_id, latency_ms, extras = {}) => {
    return {
        success: Boolean(success),
        data: data !== undefined ? data : null,
        error: error ? String(error) : null,
        correlation_id: correlation_id || 'unknown',
        latency_ms: Number(latency_ms) || 0,
        ...extras
    };
};

/**
 * Core request execution wrapper
 */
const executeRequest = async (url, options = {}) => {
    // Rule 2: Requests allowed only to /api/*
    if (!url.startsWith('/api/')) {
        console.error('[API Client Violation] Attempted to call non-API endpoint:', url);
        return formatResponse(false, null, 'Architecture Violation: Requests allowed only to /api/*', 'local-violation', 0);
    }

    const startTime = performance.now();
    const requestId = generateRequestId();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    let authHeader = {};
    let actorHeader = {};
    try {
        const rawUser = localStorage.getItem('master_ai_user');
        if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.idToken) {
                authHeader = { Authorization: `Bearer ${parsed.idToken}` };
            }
            if (parsed?.email) {
                actorHeader = { 'X-Actor-Email': String(parsed.email).toLowerCase() };
            }
        }
    } catch (_e) {
        // Ignore malformed local state and proceed unauthenticated.
    }

    // Rule 3: Must attach request_id automatically
    const headers = {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...authHeader,
        ...actorHeader,
        ...options.headers,
    };

    // If body is FormData, we must let the browser set the Content-Type with the correct boundary
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const fetchOptions = {
        ...options,
        headers,
    };
    const requestUrl = baseUrl ? `${baseUrl}${url}` : url;

    let response;
    let responseData;
    let fetchError;

    try {
        response = await fetch(requestUrl, fetchOptions);

        // Attempt to parse JSON response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            // Unlikely for our API, but handle text if needed or fallback
            responseData = await response.text();
        }

    } catch (err) {
        fetchError = err;
    }

    const latency_ms = Math.round(performance.now() - startTime);

    // Get correlation ID from response headers if available, otherwise use our generated request ID
    const correlation_id = response?.headers?.get('X-Correlation-ID') || requestId;

    // Handle Network Errors (fetch throw)
    if (fetchError) {
        return formatResponse(false, null, `Network Error: ${fetchError.message}`, correlation_id, latency_ms);
    }

    // Rule 5: Normalize response
    // If the backend already returns our standard shape, use it as the base
    if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        return formatResponse(
            response.ok ? responseData.success : false,
            responseData.data,
            !response.ok && !responseData.error ? `HTTP ${response.status}: ${response.statusText}` : responseData.error,
            responseData.correlation_id || correlation_id,
            latency_ms,
            {
                uploaded_image_urls: responseData.uploaded_image_urls
            }
        );
    }

    // If backend returns a non-standard shape, wrap it
    if (response.ok) {
        return formatResponse(true, responseData, null, correlation_id, latency_ms);
    } else {
        // Fallback for non-200 responses that aren't formatted
        const errorMsg = typeof responseData === 'string' ? responseData :
            (responseData?.message || responseData?.error || `HTTP Error ${response.status}`);
        return formatResponse(false, null, errorMsg, correlation_id, latency_ms);
    }
};

/**
 * Public API Methods
 */
export const apiClient = {
    get: (url, options = {}) => executeRequest(url, { ...options, method: 'GET' }),

    post: (url, data, options = {}) => executeRequest(url, {
        ...options,
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data)
    }),

    put: (url, data, options = {}) => executeRequest(url, {
        ...options,
        method: 'PUT',
        body: data instanceof FormData ? data : JSON.stringify(data)
    }),

    delete: (url, options = {}) => executeRequest(url, { ...options, method: 'DELETE' }),
};

export default apiClient;
