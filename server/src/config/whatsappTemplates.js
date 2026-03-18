/**
 * WhatsApp template inventory.
 * Source: user-provided Meta template list screenshot (Mar 16, 2026).
 * This is the local source of truth used by CommunicationsAI validation.
 */
const WHATSAPP_TEMPLATES = [
    { key: 'auth_otp', name: 'otp_en', category: 'Authentication', language: 'en_US', status: 'ACTIVE' },
    { key: 'rent_due_cycle', name: 'rent_due_cycle_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { key: 'payment_received_confirmation', name: 'payment_received_confirmation_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { key: 'booking_hold_confirmation', name: 'booking_hold_confirmation_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { key: 'onboarding_confirmation', name: 'onboarding_confirmation_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { key: 'police_verification_request', name: 'police_verification_request_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { key: 'offboarding_settlement', name: 'offboarding_settlement_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { key: 'likely_unpaid_summary_ceo', name: 'likely_unpaid_summary_ceo_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { name: 'hello_world', category: 'Utility', language: 'en_US', status: 'ACTIVE' }
];

function getTemplateByName(name) {
    return WHATSAPP_TEMPLATES.find(t => t.name === name) || null;
}

function getTemplateByKey(key) {
    return WHATSAPP_TEMPLATES.find(t => t.key === key) || null;
}

module.exports = {
    WHATSAPP_TEMPLATES,
    getTemplateByName,
    getTemplateByKey
};
