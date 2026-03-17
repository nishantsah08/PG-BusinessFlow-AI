const MasterAI = require('../../../server/src/agents/MasterAI');
const FinanceAI = require('../../../server/src/agents/FinanceAI');
const CommunicationsAI = require('../../../server/src/agents/CommunicationsAI');
const BusinessConfig = require('../../../server/src/config/business');

describe('Parallel Multi-Actor E2E Scenario Tests', () => {
    beforeAll(() => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    });

    test('parallel finance requests require CEO authorization and execute concurrently after approval', async () => {
        const financeAI = new FinanceAI();
        const masterAI = new MasterAI([financeAI]);

        const pendingRequests = await Promise.all([
            masterAI.executeSubagentTool('FinanceAI', 'onboard_tenant_contract', {
                lead_id: '+919100000001',
                negotiated_rent: 11000,
                security_deposit: 2500
            }),
            masterAI.executeSubagentTool('FinanceAI', 'record_incoming_txn', {
                payer_id: '+919100000001',
                amount: 5000,
                payment_mode: 'UPI',
                requested_by: 'Kalyani',
                requested_by_role: 'Sales'
            }),
            masterAI.executeSubagentTool('FinanceAI', 'record_outgoing_txn', {
                category: 'OpEx',
                sub_category: 'Visit Logistics',
                work_done: 'Caretaker travel reimbursement',
                property_id: 'PROP-1',
                amount: 400,
                payee: 'Caretaker',
                payment_mode: 'UPI',
                requested_by: 'Kalyani',
                requested_by_role: 'Sales'
            })
        ]);

        pendingRequests.forEach(r => {
            expect(r.status).toBe('PENDING_CEO_AUTHORIZATION');
            expect(r.authorization_id).toBeTruthy();
        });

        expect(financeAI.transactions.length).toBe(0);

        const blockedApproval = await masterAI.callTool('approve_financial_workflow_request', {
            authorization_id: pendingRequests[0].authorization_id,
            approved_by: 'ops.manager@bestpg.local'
        });
        expect(blockedApproval.success).toBe(false);

        const approvals = await Promise.all(
            pendingRequests.map((r) =>
                masterAI.callTool('approve_financial_workflow_request', {
                    authorization_id: r.authorization_id,
                    approved_by: BusinessConfig.persona.ceo_email
                })
            )
        );

        approvals.forEach(a => {
            expect(a.success).toBe(true);
            expect(['EXECUTED', 'EXECUTION_FAILED']).toContain(a.status);
        });

        // At least incoming + outgoing transaction should exist after CEO approval.
        expect(financeAI.transactions.length).toBeGreaterThanOrEqual(2);
    });

    test('parallel CommunicationAI conversations remain isolated and bidirectional', async () => {
        const comms = new CommunicationsAI();
        const users = [
            { email: 'tenant1@test.local', text: 'Need room from next week' },
            { email: 'tenant2@test.local', text: 'Can I visit today evening?' },
            { email: 'caretaker@test.local', text: 'Audio preferred for visit updates' }
        ];

        const normalized = await Promise.all(
            users.map((u, i) =>
                comms.callTool('handle_portal_message', {
                    messages: [{ role: 'user', content: u.text }],
                    user: { email: u.email, role: i === 2 ? 'Caretaker' : 'Tenant' },
                    correlation_id: `corr-par-${i}`
                })
            )
        );

        expect(normalized).toHaveLength(3);
        normalized.forEach((evt, idx) => {
            expect(evt.event_type).toBe('message.received');
            expect(evt.context.channel).toBe('portal');
            expect(evt.correlation.correlation_id).toBe(`corr-par-${idx}`);
        });

        // Bidirectional outbound examples (template + text)
        const outbound = await Promise.all([
            comms.callTool('send_template_message', {
                recipient_phone: '+919100000001',
                template_name: 'rent_due_cycle_en'
            }),
            comms.callTool('send_text_message', {
                recipient_phone: '+919100000002',
                content: 'Visit slot confirmed with caretaker at 6:30 PM.'
            })
        ]);

        outbound.forEach((r) => expect(r.status).toBe('success'));
    });

    test('caretaker audio-first scheduling + house rules distribution use CommunicationAI artifacts', async () => {
        const comms = new CommunicationsAI();
        const caretakerPhone = '+919100000099';
        const tenantPhone = '+919100000005';

        const caretakerAudio = await comms.callTool('send_media_message', {
            recipient_phone: caretakerPhone,
            media_type: 'audio',
            media_url: 'https://example.com/audio/visit-slot-note.ogg',
            caption: 'Visit slot coordination note'
        });
        expect(caretakerAudio.status).toBe('success');

        const locationTemplate = await comms.callTool('send_template_message', {
            recipient_phone: tenantPhone,
            template_name: 'onboarding_confirmation_en'
        });
        expect(locationTemplate.status).toBe('success');

        const houseRules = await comms.callTool('send_media_message', {
            recipient_phone: tenantPhone,
            media_type: 'document',
            media_url: 'artifacts/House Rules & Living Guide – Best PG in Dighi (v5.0).pdf',
            caption: 'Please review and acknowledge house rules.'
        });
        expect(houseRules.status).toBe('success');
    });
});
