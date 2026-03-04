const MasterAI = require('../../../server/src/agents/MasterAI');
const CommunicationsAI = require('../../../server/src/agents/CommunicationsAI');
const CRMAgent = require('../../../server/src/agents/CRMAgent');
const PropertyAI = require('../../../server/src/agents/PropertyAI');
const FinanceAI = require('../../../server/src/agents/FinanceAI');
const BusinessConfig = require('../../../server/src/config/business');

describe('Tenant Lifecycle Parallel Simulation', () => {
    beforeAll(() => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    });

    test('moves two tenants through enquiry to exit in parallel with finance authorization gates', async () => {
        const comms = new CommunicationsAI();
        const crm = new CRMAgent();
        const property = new PropertyAI();
        const finance = new FinanceAI();
        const master = new MasterAI([comms, crm, property, finance]);

        const building = await master.executeSubagentTool('PropertyAI', 'add_property', {
            name: 'Best PG Dighi',
            address: 'Dighi, Pune'
        });
        const unitA = await master.executeSubagentTool('PropertyAI', 'add_unit', {
            property_id: building.property_id,
            unit_number: 'A-101',
            floor: 1,
            amenities: []
        });
        const unitB = await master.executeSubagentTool('PropertyAI', 'add_unit', {
            property_id: building.property_id,
            unit_number: 'B-201',
            floor: 2,
            amenities: []
        });

        const tenants = [
            { phone: '+919111111111', name: 'Tenant One', unit_id: unitA.unit_id, rent: 12000 },
            { phone: '+919222222222', name: 'Tenant Two', unit_id: unitB.unit_id, rent: 13000 }
        ];

        const runTenantLifecycle = async (tenant, actor) => {
            // Enquiry -> lead created.
            const lead = await master.executeSubagentTool('CRMAgent', 'add_lead', {
                name: tenant.name,
                primary_phone: tenant.phone,
                profile_type: 'Customer'
            });
            expect(['Lead Created', 'Conflict']).toContain(lead.status);

            // Visit scheduling conversation path (caretaker audio-first).
            const visitAudio = await master.executeSubagentTool('CommunicationsAI', 'send_media_message', {
                recipient_phone: BusinessConfig.persona.ceo_phone,
                media_type: 'audio',
                media_url: 'https://example.com/audio/caretaker-visit-note.ogg',
                caption: `Visit timing note for ${tenant.name}`
            });
            expect(visitAudio.status).toBe('success');

            // Booking.
            const booking = await master.executeSubagentTool('PropertyAI', 'assign_tenant', {
                unit_id: tenant.unit_id,
                lead_id: tenant.phone,
                start_date: '2026-03-15',
                monthly_rent: tenant.rent,
                security_deposit: 2500
            });
            expect(booking.status).toBe('Tenant Assigned');

            const toVisited = await master.executeSubagentTool('CRMAgent', 'change_status', {
                lead_id: tenant.phone,
                to_status: 'Visited',
                reason: 'Visit completed by caretaker'
            });
            expect(toVisited.status).toBe('Status Updated');

            const toOnboarded = await master.executeSubagentTool('CRMAgent', 'change_status', {
                lead_id: tenant.phone,
                to_status: 'Onboarded',
                reason: 'Booking completed by sales'
            });
            expect(toOnboarded.status).toBe('Status Updated');

            // Finance onboarding request -> CEO authorize -> execute.
            const contractPending = await master.executeSubagentTool('FinanceAI', 'onboard_tenant_contract', {
                lead_id: tenant.phone,
                negotiated_rent: tenant.rent,
                security_deposit: 2500,
                requested_by: actor.sales,
                requested_by_role: 'Sales'
            });
            expect(contractPending.status).toBe('PENDING_CEO_AUTHORIZATION');

            const contractApproved = await master.callTool('approve_financial_workflow_request', {
                authorization_id: contractPending.authorization_id,
                approved_by: BusinessConfig.persona.ceo_email
            });
            expect(contractApproved.success).toBe(true);
            expect(contractApproved.result.workflow_id).toBe('finance_onboard_tenant_contract_v1');

            // Monthly bill request -> CEO authorize -> execute.
            const billPending = await master.executeSubagentTool('FinanceAI', 'generate_monthly_bills', {
                payer_id: tenant.phone,
                month_year: 'Mar 2026',
                requested_by: actor.sales,
                requested_by_role: 'Sales'
            });
            expect(billPending.status).toBe('PENDING_CEO_AUTHORIZATION');
            const billApproved = await master.callTool('approve_financial_workflow_request', {
                authorization_id: billPending.authorization_id,
                approved_by: BusinessConfig.persona.ceo_email
            });
            expect(billApproved.success).toBe(true);
            expect(billApproved.result.status).toBe('SUCCESS');

            // Payment request -> CEO bank confirmation modeled by authorization -> execute.
            const payPending = await master.executeSubagentTool('FinanceAI', 'record_incoming_txn', {
                payer_id: tenant.phone,
                amount: tenant.rent,
                payment_mode: 'UPI',
                requested_by: actor.sales,
                requested_by_role: 'Sales'
            });
            expect(payPending.status).toBe('PENDING_CEO_AUTHORIZATION');
            const payApproved = await master.callTool('approve_financial_workflow_request', {
                authorization_id: payPending.authorization_id,
                approved_by: BusinessConfig.persona.ceo_email
            });
            expect(payApproved.success).toBe(true);
            expect(payApproved.result.status).toBe('SUCCESS');

            // House rules sent.
            const rulesSent = await master.executeSubagentTool('CommunicationsAI', 'send_media_message', {
                recipient_phone: tenant.phone,
                media_type: 'document',
                media_url: 'artifacts/House Rules & Living Guide – Best PG in Dighi (v5.0).pdf',
                caption: 'House rules shared. Please acknowledge.'
            });
            expect(rulesSent.status).toBe('success');

            // Complaint lifecycle via caretaker.
            const complaint = await master.executeSubagentTool('PropertyAI', 'log_maintenance_req', {
                property_id: building.property_id,
                unit_id: tenant.unit_id,
                category: 'ELECTRICAL',
                description: `Complaint raised by ${actor.caretaker}`,
                priority: 'MEDIUM',
                reported_by: actor.caretaker
            });
            expect(complaint.status).toBe('Ticket Logged');

            const resolved = await master.executeSubagentTool('PropertyAI', 'update_maintenance_req', {
                ticket_id: complaint.ticket_id,
                status: 'RESOLVED',
                remarks: `Resolved by ${actor.caretaker}`
            });
            expect(resolved.status).toBe('Ticket Updated');

            // Offboarding lifecycle: notice first, then final exit.
            const notice = await master.executeSubagentTool('PropertyAI', 'vacate_tenant', {
                unit_id: tenant.unit_id,
                end_date: '2026-06-30'
            });
            expect(notice.current_status).toBe('NOTICE');

            const finalVacate = await master.executeSubagentTool('PropertyAI', 'vacate_tenant', {
                unit_id: tenant.unit_id,
                end_date: '2026-03-01'
            });
            expect(finalVacate.current_status).toBe('AVAILABLE');

            const status = await master.executeSubagentTool('CRMAgent', 'change_status', {
                lead_id: tenant.phone,
                to_status: 'Left',
                reason: 'Lifecycle simulation completed'
            });
            expect(status.status).toBe('Status Updated');
        };

        const actors = [
            { sales: 'Kalyani-Sales-A', caretaker: 'Caretaker-A' },
            { sales: 'Kalyani-Sales-B', caretaker: 'Caretaker-B' }
        ];

        await Promise.all(tenants.map((t, i) => runTenantLifecycle(t, actors[i])));

        // Final consistency: both units should be available again.
        const finalUnitA = await master.executeSubagentTool('PropertyAI', 'get_units', { unit_id: unitA.unit_id });
        const finalUnitB = await master.executeSubagentTool('PropertyAI', 'get_units', { unit_id: unitB.unit_id });
        expect(finalUnitA.status).toBe('AVAILABLE');
        expect(finalUnitB.status).toBe('AVAILABLE');
    });
});
