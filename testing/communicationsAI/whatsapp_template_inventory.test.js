const CommunicationsAI = require('../../server/src/agents/CommunicationsAI');
const { WHATSAPP_TEMPLATES } = require('../../server/src/config/whatsappTemplates');

describe('WhatsApp template inventory enforcement', () => {
    test('allows sending only templates present in local inventory', async () => {
        const comms = new CommunicationsAI();

        const allowed = await comms.callTool('send_template_message', {
            recipient_phone: '+917588498834',
            template_name: 'v1_boys_en'
        });
        expect(allowed.status).toBe('success');

        const blocked = await comms.callTool('send_template_message', {
            recipient_phone: '+917588498834',
            template_name: 'unknown_template_name'
        });
        expect(blocked.status).toBe('error');
    });

    test('inventory includes user-provided core templates', () => {
        const names = WHATSAPP_TEMPLATES.map(t => t.name);
        expect(names).toEqual(expect.arrayContaining([
            'v1_onboarding_en',
            'v1_payment_dynamic_en',
            'v1_payment_static_en',
            'v1_boys_en',
            'hello_world'
        ]));
    });
});
