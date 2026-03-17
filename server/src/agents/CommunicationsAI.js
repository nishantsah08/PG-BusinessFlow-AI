const BaseAgent = require('./BaseAgent');
const WhatsAppAdapter = require('./WhatsAppAdapter');
const TimeAuthorityService = require('../services/TimeAuthorityService');
const { getTemplateByName } = require('../config/whatsappTemplates');
const WhatsAppConversationWindowService = require('../services/WhatsAppConversationWindowService');

class CommunicationsAI extends BaseAgent {
    constructor() {
        super({
            name: 'CommunicationsAI',
            identity: {
                role: 'Communications Gateway',
                description: 'Handles all external messaging via adapters (WhatsApp Only Phase 1).'
            },
            capabilities: {
                skills: ['WhatsApp Messaging', 'Media Handling', 'Profile Management'],
                tools: [
                    'handle_portal_message',
                    'send_whatsapp_message',
                    'send_text_message',
                    'send_media_message',
                    'send_template_message',
                    'get_whatsapp_conversation_window',
                    'send_location_message',
                    'send_contact_message',
                    'send_interactive_message',
                    'check_contact_status',
                    'mark_message_as_read',
                    'get_business_profile',
                    'update_business_profile',
                    'download_media'
                ]
            },
            directives: {
                goals: ['Delightful communication', 'Reliable delivery'],
                constraints: ['No decision making', 'Use Adapters Only']
            }
        });

        this.whatsapp = new WhatsAppAdapter();
        this.registerTools();
    }

    registerTools() {
        // --- Inbound Normalization ---
        this.registerTool('handle_portal_message', 'Normalize inbound web portal message into a system event envelope', {
            type: 'object',
            properties: {
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string' },
                            content: { type: 'string' }
                        },
                        required: ['role', 'content']
                    }
                },
                user: { type: 'object' },
                correlation_id: { type: 'string' }
            },
            required: ['messages']
        }, async (args) => {
            const messages = Array.isArray(args.messages) ? args.messages : [];
            const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
            const processingTime = TimeAuthorityService.nowIST();
            const correlationId = args.correlation_id || `corr_portal_${Date.now()}`;
            const userId = args.user?.email || 'portal_user';

            return {
                event_id: `evt_portal_${Date.now()}`,
                event_type: 'message.received',
                event_version: 'v1',
                timestamp: processingTime,
                source: {
                    type: 'adapter',
                    name: 'PortalAdapter',
                    instance_id: 'portal_web_01'
                },
                target: {
                    type: 'agent',
                    name: 'Router'
                },
                routing: {
                    priority: 'normal',
                    mode: 'sync',
                    ttl_ms: 60000
                },
                correlation: {
                    correlation_id: correlationId,
                    causation_id: correlationId,
                    session_id: userId,
                    conversation_id: `conv_portal_${userId}`
                },
                context: {
                    channel: 'portal',
                    user_id: userId,
                    user: args.user || null
                },
                payload: {
                    from: userId,
                    body: lastUserMsg?.content || '',
                    history: messages,
                    raw: { channel: 'portal' }
                },
                observability: {
                    received_at: processingTime,
                    processed_at: processingTime,
                    latency_ms: 0
                }
            };
        });

        // --- Outbound Messaging ---

        this.registerTool('send_whatsapp_message', 'Send WhatsApp outbound with free-text first and template fallback when the customer window is closed', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                content: { type: 'string' },
                preview_url: { type: 'boolean' },
                fallback_template_name: { type: 'string' },
                fallback_language_code: { type: 'string' },
                fallback_components: { type: 'array', items: { type: 'object' } },
                correlation_id: { type: 'string' }
            },
            required: ['recipient_phone', 'content']
        }, async (args) => {
            const windowStatus = WhatsAppConversationWindowService.getWindowStatus(args.recipient_phone);
            let result = null;
            let dispatchMode = 'free_text';

            if (windowStatus.window_open) {
                result = await this.whatsapp.sendTextMessage(args.recipient_phone, args.content, args.preview_url);
            } else {
                const templateName = String(args.fallback_template_name || '').trim();
                if (!templateName) {
                    return {
                        status: 'error',
                        error: 'Free-form WhatsApp window is closed and no approved template fallback was provided.',
                        conversation_window: windowStatus
                    };
                }

                const template = getTemplateByName(templateName);
                if (!template) {
                    return {
                        status: 'error',
                        error: `Template '${templateName}' not present in local template inventory.`,
                        conversation_window: windowStatus
                    };
                }

                dispatchMode = 'template_fallback';
                const languageCode = args.fallback_language_code || template.language;
                result = await this.whatsapp.sendTemplateMessage(
                    args.recipient_phone,
                    templateName,
                    languageCode,
                    Array.isArray(args.fallback_components) ? args.fallback_components : []
                );
            }

            result.dispatch_mode = dispatchMode;
            result.conversation_window = windowStatus;
            if (args.correlation_id) result.correlation_id = args.correlation_id;
            return result;
        });

        this.registerTool('send_text_message', 'Send simple text via WhatsApp', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                content: { type: 'string' },
                preview_url: { type: 'boolean' },
                correlation_id: { type: 'string' } // Added for Traceability
            },
            required: ['recipient_phone', 'content']
        }, async (args) => {
            const result = await this.whatsapp.sendTextMessage(args.recipient_phone, args.content, args.preview_url);
            // Append correlation for full lifecycle tracing
            if (args.correlation_id) result.correlation_id = args.correlation_id;
            return result;
        });

        this.registerTool('send_media_message', 'Send media file via WhatsApp', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                media_type: { type: 'string', enum: ['image', 'document', 'audio', 'video'] },
                media_url: { type: 'string' },
                caption: { type: 'string' },
                correlation_id: { type: 'string' }
            },
            required: ['recipient_phone', 'media_type', 'media_url']
        }, async (args) => {
            const result = await this.whatsapp.sendMediaMessage(args.recipient_phone, args.media_type, args.media_url, args.caption);
            if (args.correlation_id) result.correlation_id = args.correlation_id;
            return result;
        });

        this.registerTool('send_template_message', 'Send approved template via WhatsApp', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                template_name: { type: 'string' },
                language_code: { type: 'string' },
                components: { type: 'array', items: { type: 'object' } }
            },
            required: ['recipient_phone', 'template_name']
        }, async (args) => {
            const template = getTemplateByName(args.template_name);
            if (!template) {
                return {
                    status: 'error',
                    error: `Template '${args.template_name}' not present in local template inventory.`
                };
            }

            const languageCode = args.language_code || template.language;
            return await this.whatsapp.sendTemplateMessage(
                args.recipient_phone,
                args.template_name,
                languageCode,
                args.components
            );
        });

        this.registerTool('get_whatsapp_conversation_window', 'Get internally tracked WhatsApp customer-service window status for a phone', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' }
            },
            required: ['recipient_phone']
        }, async (args) => {
            return {
                status: 'success',
                data: WhatsAppConversationWindowService.getWindowStatus(args.recipient_phone)
            };
        });

        this.registerTool('send_location_message', 'Send location pin via WhatsApp', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                latitude: { type: 'string' }, // API accepts string for consistency
                longitude: { type: 'string' },
                name: { type: 'string' },
                address: { type: 'string' }
            },
            required: ['recipient_phone', 'latitude', 'longitude']
        }, async (args) => {
            return await this.whatsapp.sendLocationMessage(args.recipient_phone, args.latitude, args.longitude, args.name, args.address);
        });

        this.registerTool('send_contact_message', 'Send vCard contact via WhatsApp', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                contact_name: { type: 'string' },
                contact_phone: { type: 'string' }
            },
            required: ['recipient_phone', 'contact_name', 'contact_phone']
        }, async (args) => {
            return await this.whatsapp.sendContactMessage(args.recipient_phone, args.contact_name, args.contact_phone);
        });

        this.registerTool('send_interactive_message', 'Send buttons/list via WhatsApp', {
            type: 'object',
            properties: {
                recipient_phone: { type: 'string' },
                type: { type: 'string', enum: ['button', 'list'] },
                header: { type: 'string' },
                body: { type: 'string' },
                footer: { type: 'string' },
                action: { type: 'object' } // Complex object for buttons/sections
            },
            required: ['recipient_phone', 'type', 'body', 'action']
        }, async (args) => {
            return await this.whatsapp.sendInteractiveMessage(args.recipient_phone, args.type, args.header, args.body, args.footer, args.action);
        });

        // --- Session & Contact Mgmt ---

        this.registerTool('check_contact_status', 'Verify WhatsApp number', {
            type: 'object',
            properties: {
                phone_number: { type: 'string' }
            },
            required: ['phone_number']
        }, async (args) => {
            return await this.whatsapp.checkContactStatus(args.phone_number);
        });

        this.registerTool('mark_message_as_read', 'Send read receipt', {
            type: 'object',
            properties: {
                message_id: { type: 'string' }
            },
            required: ['message_id']
        }, async (args) => {
            return await this.whatsapp.markMessageAsRead(args.message_id);
        });

        this.registerTool('get_business_profile', 'Get Business Profile', {
            type: 'object',
            properties: {}
        }, async (args) => {
            return await this.whatsapp.getBusinessProfile();
        });

        this.registerTool('update_business_profile', 'Update Business Profile', {
            type: 'object',
            properties: {
                about: { type: 'string' },
                address: { type: 'string' },
                email: { type: 'string' },
                websites: { type: 'array', items: { type: 'string' } },
                profile_picture_url: { type: 'string' }
            }
        }, async (args) => {
            return await this.whatsapp.updateBusinessProfile(args);
        });

        this.registerTool('download_media', 'Download media from Meta to GCS (Local for now)', {
            type: 'object',
            properties: {
                media_id: { type: 'string' }
            },
            required: ['media_id']
        }, async (args) => {
            return await this.whatsapp.downloadMedia(args.media_id);
        });

        // --- Webhooks ---

        this.registerTool('handle_incoming_message', 'Process inbound WhatsApp webhook', {
            type: 'object',
            properties: {
                payload: { type: 'object' }
            },
            required: ['payload']
        }, async (args) => {
            const rawEvent = await this.whatsapp.handleIncomingMessage(args.payload);
            if (!rawEvent) return null;
            WhatsAppConversationWindowService.recordInboundMessage(rawEvent.from, rawEvent.timestamp);

            // Enshrine System Reliability Layer
            const processingTime = TimeAuthorityService.nowIST();
            const receivedAt = rawEvent.timestamp ? TimeAuthorityService.toIST(new Date(rawEvent.timestamp * 1000)) : processingTime;

            // IS2: Expired Timestamp Check (5 minute tolerance)
            const eventTime = new Date(receivedAt).getTime();
            if (Date.now() - eventTime > 5 * 60 * 1000) {
                return { error: "Event rejected: Timestamp expired", code: "IS2_EXPIRED" };
            }

            // IP1: Deterministic Event ID (Replay Safety)
            const deterministicId = `evt_${rawEvent.from}_${rawEvent.id}`;

            return {
                event_id: deterministicId,
                event_type: rawEvent.type,
                event_version: "v1",
                timestamp: processingTime,
                source: {
                    type: "adapter",
                    name: "WhatsAppAdapter",
                    instance_id: "wa_prod_01"
                },
                target: {
                    type: "agent",
                    name: "Router"
                },
                routing: {
                    priority: "critical", // IR2: Routing Priority
                    mode: "async",
                    ttl_ms: 60000,
                    retry_policy: "simple"
                },
                correlation: {
                    correlation_id: `corr_${rawEvent.id}`, // IR1: Correlation Chain Start
                    causation_id: rawEvent.id,
                    session_id: rawEvent.from,
                    conversation_id: `conv_${rawEvent.from}` // Persist conversation context
                },
                auth: {
                    actor_id: "system",
                    actor_type: "system",
                    roles: ["gateway"]
                },
                context: {
                    channel: "whatsapp",
                    user_id: rawEvent.from
                },
                payload: {
                    from: rawEvent.from,
                    body: rawEvent.body,
                    media: rawEvent.media,
                    raw: rawEvent.raw
                },
                observability: {
                    received_at: receivedAt,
                    processed_at: processingTime,
                    latency_ms: Date.now() - (rawEvent.timestamp * 1000) // IR3: Latency Calculation
                }
            };
        });

        this.registerTool('handle_delivery_status', 'Process delivery status webhook', {
            type: 'object',
            properties: {
                payload: { type: 'object' }
            },
            required: ['payload']
        }, async (args) => {
            const statusEvent = await this.whatsapp.handleDeliveryStatus(args.payload);
            if (!statusEvent) return null;

            // Enshrine System Reliability Layer
            const processingTime = TimeAuthorityService.nowIST();

            return {
                event_id: `evt_status_${statusEvent.id}_${statusEvent.status}`, // Deterministic ID for Status
                event_type: statusEvent.type,
                event_version: "v1",
                timestamp: processingTime,
                source: { type: "adapter", name: "WhatsAppAdapter" },
                target: { type: "agent", name: "Router" },
                routing: { priority: "low", mode: "async", ttl_ms: 60000 },
                correlation: {
                    correlation_id: `unknown`, // Needs to be looked up from state in real system
                    causation_id: statusEvent.id
                },
                payload: statusEvent,
                observability: {
                    received_at: statusEvent.timestamp ? TimeAuthorityService.toIST(new Date(statusEvent.timestamp * 1000)) : processingTime,
                    processed_at: processingTime
                }
            };
        });
    }
}

module.exports = CommunicationsAI;
