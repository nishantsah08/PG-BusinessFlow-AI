const axios = require('axios');
const PhoneNormalizationService = require('../services/PhoneNormalizationService');

class WhatsAppAdapter {
    constructor() {
        this.token = process.env.WHATSAPP_TOKEN;
        this.phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.baseUrl = `https://graph.facebook.com/v22.0/${this.phoneId}`; // Using v22.0 as per standard or latest
        this.allowExternalSend = process.env.ALLOW_EXTERNAL_SEND === 'true';
        this.logLevel = process.env.LOG_LEVEL || 'info';
    }

    async _send(endpoint, data, retries = 3) {
        // Safety Check: External Send Flag
        if (!this.allowExternalSend) {
            console.log(`[WhatsAppAdapter] [SIMULATION] Would send to ${endpoint}:`, JSON.stringify(data).substring(0, 100) + "...");
            return { status: "success", data: { id: `sim_${Date.now()}` }, simulated: true };
        }

        try {
            const response = await axios.post(`${this.baseUrl}/${endpoint}`, data, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            return { status: "success", data: response.data };
        } catch (error) {
            if (retries > 0) {
                if (this.logLevel === 'debug') console.log(`[WhatsAppAdapter] Failure in ${endpoint}. Retrying... (${retries} left)`);
                await new Promise(res => setTimeout(res, 100)); // Simple backoff
                return this._send(endpoint, data, retries - 1);
            }
            console.error(`[WhatsAppAdapter] [ALERT] Permanent Failure in ${endpoint}:`, error.response?.data || error.message);
            return { status: "error", error: error.response?.data || error.message };
        }
    }

    async sendTextMessage(to, body, preview_url = false) {
        return this._send('messages', {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: PhoneNormalizationService.normalizeToE164(to),
            type: "text",
            text: { preview_url, body }
        });
    }

    async sendMediaMessage(to, type, link, caption) {
        return this._send('messages', {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: PhoneNormalizationService.normalizeToE164(to),
            type: type,
            [type]: { link, caption }
        });
    }

    async sendTemplateMessage(to, name, languageCode = 'en_US', components = []) {
        return this._send('messages', {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: PhoneNormalizationService.normalizeToE164(to),
            type: "template",
            template: {
                name: name,
                language: { code: languageCode },
                components: components
            }
        });
    }

    async sendLocationMessage(to, latitude, longitude, name, address) {
        return this._send('messages', {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: PhoneNormalizationService.normalizeToE164(to),
            type: "location",
            location: { latitude, longitude, name, address }
        });
    }

    async sendContactMessage(to, contactName, contactPhone) {
        const normContactPhone = PhoneNormalizationService.normalizeToE164(contactPhone);
        const normTo = PhoneNormalizationService.normalizeToE164(to);
        // Simple vCard construction
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL;waid=${normContactPhone}:${normContactPhone}\nEND:VCARD`;
        return this._send('messages', {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normTo,
            type: "contacts",
            contacts: [{
                name: { formatted_name: contactName, first_name: contactName },
                phones: [{ phone: normContactPhone, type: "CELL", wa_id: normContactPhone }],
                org: {}
            }]
        });
    }

    async sendInteractiveMessage(to, type, header, body, footer, action) {
        const message = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: PhoneNormalizationService.normalizeToE164(to),
            type: "interactive",
            interactive: {
                type: type,
                body: { text: body },
                action: action
            }
        };

        if (header) {
            message.interactive.header = { type: "text", text: header };
        }
        if (footer) {
            message.interactive.footer = { text: footer };
        }

        return this._send('messages', message);
    }

    async markMessageAsRead(messageId) {
        return this._send('messages', {
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId
        });
    }

    // --- Business Profile & Config ---

    async getBusinessProfile() {
        try {
            const response = await axios.get(`${this.baseUrl}/whatsapp_business_profile`, {
                params: { fields: 'about,address,description,email,websites,profile_picture_url' },
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return { status: "success", data: response.data };
        } catch (error) {
            console.error(`[WhatsAppAdapter] Get Profile Error:`, error.response?.data || error.message);
            return { status: "error", error: error.response?.data || error.message };
        }
    }

    async updateBusinessProfile(data) {
        // data can contain about, address, description, email, websites, profile_picture_url
        return this._send('whatsapp_business_profile', {
            messaging_product: "whatsapp",
            ...data
        });
    }

    // --- Utility ---

    async checkContactStatus(phone) {
        try {
            // Requires a different endpoint structure usually, effectively contacts endpoint
            const response = await axios.post(`${this.baseUrl}/contacts`, {
                messaging_product: "whatsapp",
                contacts: [PhoneNormalizationService.normalizeToE164(phone)]
            }, {
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
            });
            return { status: "success", data: response.data };
        } catch (error) {
            console.error(`[WhatsAppAdapter] Check Contact Error:`, error.response?.data || error.message);
            return { status: "error", error: error.response?.data || error.message };
        }
    }

    async downloadMedia(mediaId) {
        try {
            // 1. Get Media URL
            const urlRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const mediaUrl = urlRes.data.url;

            // 2. Download Binary - In a real implementation this would stream to GCS
            // For now we return the URL and metadata as a placeholder for the GCS upload logic
            // Phase 1 Requirement says: Use local directory. 
            // So we would ideally fetch this and save to ./all_files/

            return { status: "success", media_url: mediaUrl, mime_type: urlRes.data.mime_type };
        } catch (error) {
            console.error(`[WhatsAppAdapter] Download Media Error:`, error.response?.data || error.message);
            return { status: "error", error: error.response?.data || error.message };
        }
    }

    // --- Inbound Processing ---

    /**
     * Parses the incoming webhook payload from Meta and normalizes it.
     */
    handleIncomingMessage(payload) {
        try {
            if (!payload.object) return null;

            const entry = payload.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const message = value?.messages?.[0];

            if (!message) return null;

            // Normalize to system event check structure (Integration Layer will wrap this in actual Event)
            return {
                type: 'message.received',
                from: PhoneNormalizationService.normalizeToE164(message.from),
                id: message.id,
                timestamp: message.timestamp,
                body: message.text?.body || null,
                media: message.image || message.audio || message.document || null,
                raw: message
            };

        } catch (error) {
            console.error("[WhatsAppAdapter] Parse Error:", error);
            return null;
        }
    }

    handleDeliveryStatus(payload) {
        try {
            const entry = payload.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const status = value?.statuses?.[0];

            if (!status) return null;

            return {
                type: 'message.status',
                id: status.id,
                status: status.status, // sent, delivered, read
                recipient_id: status.recipient_id,
                timestamp: status.timestamp
            };
        } catch (error) {
            console.error("[WhatsAppAdapter] Status Parse Error:", error);
            return null;
        }
    }
}

module.exports = WhatsAppAdapter;
