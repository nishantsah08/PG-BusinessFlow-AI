/**
 * MockWhatsAppProvider.js
 * 
 * Simulates Meta's WhatsApp Cloud API for testing purposes.
 * Provides methods to trigger incoming webhooks and mock outgoing responses.
 */

const crypto = require('crypto');

class MockWhatsAppProvider {
    constructor() {
        this.sentMessages = [];
        this.webhooks = [];
        // Simulate a secret for signature verification
        this.appSecret = 'mock_secret_key';
    }

    // --- Outbound Simulation ---

    /**
     * Intercepts an outgoing request and returns a mock response.
     * Use this in your test by mocking axios or the adapter's transport.
     */
    mockSendResponse(payload) {
        const messageId = `wamid.HBgL${Date.now()}`;
        this.sentMessages.push({
            id: messageId,
            payload: payload,
            timestamp: new Date().toISOString()
        });

        // Return success response structure from Meta
        return {
            messaging_product: "whatsapp",
            contacts: [{ input: payload.to, wa_id: payload.to }],
            messages: [{ id: messageId }]
        };
    }

    mockErrorResponse(code = 400) {
        // Return error structure
        const error = {
            error: {
                message: "Mock Error",
                type: "OAuthException",
                code: code,
                fbtrace_id: "AbCdEfGhIjK"
            }
        };
        throw { response: { status: code, data: error } };
    }

    // --- Inbound Simulation (Webhooks) ---

    /**
     * Generates a valid X-Hub-Signature-256 header.
     */
    signPayload(payload) {
        const hmac = crypto.createHmac('sha256', this.appSecret);
        hmac.update(JSON.stringify(payload));
        return `sha256=${hmac.digest('hex')}`;
    }

    createIncomingMessage(from, text, messageId = `wamid.${Date.now()}`) {
        return {
            object: "whatsapp_business_account",
            entry: [{
                id: "123456789",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: { display_phone_number: "15555555555", phone_number_id: "12345" },
                        contacts: [{ profile: { name: "Test User" }, wa_id: from }],
                        messages: [{
                            from: from,
                            id: messageId,
                            timestamp: Math.floor(Date.now() / 1000),
                            text: { body: text },
                            type: "text"
                        }]
                    },
                    field: "messages"
                }]
            }]
        };
    }

    createDeliveryStatus(to, messageId, status) {
        return {
            object: "whatsapp_business_account",
            entry: [{
                id: "123456789",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: { display_phone_number: "15555555555", phone_number_id: "12345" },
                        statuses: [{
                            id: messageId,
                            status: status,
                            timestamp: Math.floor(Date.now() / 1000),
                            recipient_id: to,
                            conversation: { id: "conv_id", origin: { type: "user_initiated" } },
                            pricing: { billable: true, pricing_model: "CBP", category: "business_initiated" }
                        }]
                    },
                    field: "messages"
                }]
            }]
        };
    }
}

module.exports = MockWhatsAppProvider;
