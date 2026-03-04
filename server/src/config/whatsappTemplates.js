/**
 * WhatsApp template inventory.
 * Source: user-provided Meta template screenshot (Mar 3, 2026).
 * This is the local source of truth used by CommunicationsAI validation.
 */
const WHATSAPP_TEMPLATES = [
    { name: 'v1_onboarding_en', category: 'Utility', language: 'en', status: 'ACTIVE' },
    { name: 'v1_facilities_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_feedback_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_police_verification_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_hello_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_location_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_payment_dynamic_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_payment_static_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'v1_boys_en', category: 'Marketing', language: 'en', status: 'ACTIVE' },
    { name: 'hello_world', category: 'Utility', language: 'en_US', status: 'ACTIVE' }
];

function getTemplateByName(name) {
    return WHATSAPP_TEMPLATES.find(t => t.name === name) || null;
}

module.exports = {
    WHATSAPP_TEMPLATES,
    getTemplateByName
};
