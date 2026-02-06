const BaseAgent = require('./BaseAgent');
const axios = require('axios');

class CommunicationsAI extends BaseAgent {
    constructor() {
        super({
            name: 'CommunicationsAI',
            identity: {
                role: 'Communications Gateway',
                description: 'Handles all external messaging.'
            },
            capabilities: {
                skills: ['Messaging', 'Formatting'],
                tools: ['send_message', 'update_api_config']
            },
            directives: {
                goals: ['Delightful communication'],
                constraints: ['No decision making']
            }
        });

        this.messageLog = [];
        this.config = {
            whatsapp_api_key: 'mock-key',
            email_smtp: 'mock-smtp'
        };

        this.registerTools();
    }

    registerTools() {
        this.registerTool('send_message', 'Send WhatsApp or Email', {
            type: 'object',
            properties: {
                channel: { type: 'string' }, // WhatsApp/Email
                recipient: { type: 'string' },
                content: { type: 'string' },
                tone: { type: 'string' }
            },
            required: ['channel', 'recipient', 'content']
        }, async (args) => {
            let finalContent = args.content;
            if (args.tone === 'Formal') finalContent += "\n\nRegards,\nTeam PG-BusinessFlow";
            if (args.tone === 'Casual') finalContent += " 😊";

            // Meta Cloud API Implementation
            if (args.channel === 'WhatsApp') {
                try {
                    const token = process.env.WHATSAPP_TOKEN;
                    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
                    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

                    // Basic Text Message Payload
                    const payload = {
                        messaging_product: "whatsapp",
                        to: args.recipient.replace('+', ''), // Meta requires no plus
                        text: { body: finalContent }
                    };

                    const response = await axios.post(url, payload, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    this.messageLog.push({
                        id: response.data.messages[0].id,
                        ...args,
                        final_content: finalContent,
                        sent_at: new Date().toISOString(),
                        status: 'SENT_TO_META'
                    });

                    console.log(`[CommunicationsAI] Message sent to ${args.recipient}: ${response.data.messages[0].id}`);
                    return { status: "Message Sent", meta_id: response.data.messages[0].id };

                } catch (error) {
                    console.error("[CommunicationsAI] Meta API Error:", error.response?.data || error.message);
                    return { status: "Failed", error: error.response?.data || error.message };
                }
            } else {
                // Mock Email
                console.log(`[CommunicationsAI] Mock Email to ${args.recipient}: ${finalContent}`);
                return { status: "Email Logged (Mock)" };
            }
        });

        this.registerTool('update_api_config', 'Rotate keys', {
            type: 'object',
            properties: {
                key: { type: 'string' },
                value: { type: 'string' }
            },
            required: ['key', 'value']
        }, async (args) => {
            this.config[args.key] = args.value;
            return { status: "Config Updated" };
        });
    }
}

module.exports = CommunicationsAI;
