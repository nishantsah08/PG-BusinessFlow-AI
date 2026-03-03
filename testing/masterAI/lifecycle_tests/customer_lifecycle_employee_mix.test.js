const MasterAI = require('../../../server/src/agents/MasterAI');
const CommunicationsAI = require('../../../server/src/agents/CommunicationsAI');
const CRMAgent = require('../../../server/src/agents/CRMAgent');
const PropertyAI = require('../../../server/src/agents/PropertyAI');
const FinanceAI = require('../../../server/src/agents/FinanceAI');
const BusinessConfig = require('../../../server/src/config/business');

describe('System User Lifecycle - Customer Journey with Employee Mix', () => {
    beforeAll(() => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    });

    const setup = () => {
        const comms = new CommunicationsAI();
        const crm = new CRMAgent();
        const property = new PropertyAI();
        const finance = new FinanceAI();
        const master = new MasterAI([comms, crm, property, finance]);
        return { master, comms, crm, property, finance };
    };

    test('full lifecycle: enquiry to offboarding with negotiated rent and carry-forward to next month', async () => {
        const { master, finance } = setup();

        const prop = await master.executeSubagentTool('PropertyAI', 'add_property', {
            name: 'Blue Nest PG',
            address: 'Dighi, Pune'
        });
        const unit = await master.executeSubagentTool('PropertyAI', 'add_unit', {
            property_id: prop.property_id,
            unit_number: 'C-301',
            floor: 3,
            amenities: []
        });

        const leadId = '+919300000001';
        await master.executeSubagentTool('CRMAgent', 'add_lead', {
            name: 'Tenant Lifecycle One',
            primary_phone: leadId,
            profile_type: 'Customer'
        });

        // Caretaker-first visit scheduling via audio style communication.
        const caretakerMessage = await master.executeSubagentTool('CommunicationsAI', 'send_media_message', {
            recipient_phone: leadId,
            media_type: 'audio',
            media_url: 'https://example.com/audio/caretaker-visit-note.ogg',
            caption: 'Visit slots by caretaker'
        });
        expect(caretakerMessage.status).toBe('success');

        await master.executeSubagentTool('CRMAgent', 'change_status', {
            lead_id: leadId,
            to_status: 'Visited',
            reason: 'Visit completed by caretaker'
        });

        await master.executeSubagentTool('PropertyAI', 'assign_tenant', {
            unit_id: unit.unit_id,
            lead_id: leadId,
            start_date: '2026-03-10',
            monthly_rent: 11000,
            security_deposit: 2500
        });

        await master.executeSubagentTool('CRMAgent', 'change_status', {
            lead_id: leadId,
            to_status: 'Onboarded',
            reason: 'Negotiation closed by sales'
        });

        const contractPending = await master.executeSubagentTool('FinanceAI', 'onboard_tenant_contract', {
            lead_id: leadId,
            negotiated_rent: 11000,
            security_deposit: 2500,
            requested_by: 'Kalyani',
            requested_by_role: 'Sales'
        });
        expect(contractPending.status).toBe('PENDING_CEO_AUTHORIZATION');

        const contractApproved = await master.callTool('approve_financial_workflow_request', {
            authorization_id: contractPending.authorization_id,
            approved_by: BusinessConfig.persona.ceo_email
        });
        expect(contractApproved.success).toBe(true);

        const billPending = await master.executeSubagentTool('FinanceAI', 'generate_monthly_bills', {
            payer_id: leadId,
            month_year: 'Mar 2026',
            requested_by: 'Kalyani',
            requested_by_role: 'Sales'
        });
        const billApproved = await master.callTool('approve_financial_workflow_request', {
            authorization_id: billPending.authorization_id,
            approved_by: BusinessConfig.persona.ceo_email
        });
        expect(billApproved.result.status).toBe('SUCCESS');

        const marchLedger = await finance.callTool('get_ledger', { payer_id: leadId });
        const marchRent = marchLedger.entries.find(e => e.month_year === 'Mar 2026' && e.category === 'Rent');
        expect(marchRent.amount_due).toBe(11000);

        // Overpayment creates carry-forward for next month.
        const paymentPending = await master.executeSubagentTool('FinanceAI', 'record_incoming_txn', {
            payer_id: leadId,
            amount: 13000,
            payment_mode: 'UPI',
            date: '2026-03-20',
            requested_by: 'Kalyani',
            requested_by_role: 'Sales'
        });
        const paymentApproved = await master.callTool('approve_financial_workflow_request', {
            authorization_id: paymentPending.authorization_id,
            approved_by: BusinessConfig.persona.ceo_email
        });
        expect(paymentApproved.result.status).toBe('SUCCESS');
        expect(paymentApproved.result.carry_forward.amount).toBe(2000);
        expect(paymentApproved.result.carry_forward.available_from).toBe('Apr 2026');

        const aprilBillPending = await master.executeSubagentTool('FinanceAI', 'generate_monthly_bills', {
            payer_id: leadId,
            month_year: 'Apr 2026',
            requested_by: 'Kalyani',
            requested_by_role: 'Sales'
        });
        const aprilBillApproved = await master.callTool('approve_financial_workflow_request', {
            authorization_id: aprilBillPending.authorization_id,
            approved_by: BusinessConfig.persona.ceo_email
        });
        expect(aprilBillApproved.result.applied_carry_forward.amount).toBe(2000);

        const complaint = await master.executeSubagentTool('PropertyAI', 'log_maintenance_req', {
            property_id: prop.property_id,
            unit_id: unit.unit_id,
            category: 'ELECTRICAL',
            description: 'Fan not working',
            priority: 'MEDIUM',
            reported_by: 'Caretaker'
        });
        expect(complaint.status).toBe('Ticket Logged');

        await master.executeSubagentTool('PropertyAI', 'update_maintenance_req', {
            ticket_id: complaint.ticket_id,
            status: 'RESOLVED',
            remarks: 'Resolved on-site by caretaker'
        });

        await master.executeSubagentTool('PropertyAI', 'vacate_tenant', {
            unit_id: unit.unit_id,
            end_date: '2026-06-30'
        });
        const vacate = await master.executeSubagentTool('PropertyAI', 'vacate_tenant', {
            unit_id: unit.unit_id,
            end_date: '2026-03-01'
        });
        expect(vacate.current_status).toBe('AVAILABLE');

        const left = await master.executeSubagentTool('CRMAgent', 'change_status', {
            lead_id: leadId,
            to_status: 'Left',
            reason: 'Tenant exited after lifecycle completion'
        });
        expect(left.status).toBe('Status Updated');
    });

    test('caretaker and sales can trigger finance flows, but only CEO can approve', async () => {
        const { master } = setup();

        const pending = await master.executeSubagentTool('FinanceAI', 'record_outgoing_txn', {
            category: 'OpEx',
            sub_category: 'Maintenance',
            work_done: 'Emergency plumbing',
            property_id: 'PROP-1',
            amount: 900,
            payee: 'Vendor-Plumber',
            payment_mode: 'UPI',
            requested_by: 'Kalyani',
            requested_by_role: 'Sales'
        });
        expect(pending.status).toBe('PENDING_CEO_AUTHORIZATION');

        const caretakerAttempt = await master.callTool('approve_financial_workflow_request', {
            authorization_id: pending.authorization_id,
            approved_by: '+919900000123'
        });
        expect(caretakerAttempt.success).toBe(false);
        expect(caretakerAttempt.status).toBe('REJECTED');

        const ceoApproval = await master.callTool('approve_financial_workflow_request', {
            authorization_id: pending.authorization_id,
            approved_by: BusinessConfig.persona.ceo_phone
        });
        expect(ceoApproval.success).toBe(true);
        expect(ceoApproval.result.status).toBe('SUCCESS');
    });

    test('parallel tenants progress with alternate timelines and mixed employees', async () => {
        const { master } = setup();
        const prop = await master.executeSubagentTool('PropertyAI', 'add_property', {
            name: 'Green Arc PG',
            address: 'Dighi, Pune'
        });
        const unit1 = await master.executeSubagentTool('PropertyAI', 'add_unit', {
            property_id: prop.property_id,
            unit_number: 'A-11',
            floor: 1,
            amenities: []
        });
        const unit2 = await master.executeSubagentTool('PropertyAI', 'add_unit', {
            property_id: prop.property_id,
            unit_number: 'B-21',
            floor: 2,
            amenities: []
        });

        const runTenant = async (leadId, name, unitId, actor) => {
            await master.executeSubagentTool('CRMAgent', 'add_lead', {
                name,
                primary_phone: leadId,
                profile_type: 'Customer'
            });

            // Alternate timelines: one tenant boards, other pauses and returns later.
            if (actor.path === 'onboard_now') {
                await master.executeSubagentTool('CRMAgent', 'change_status', {
                    lead_id: leadId,
                    to_status: 'Visited',
                    reason: `Visit done by ${actor.caretaker}`
                });
                await master.executeSubagentTool('PropertyAI', 'assign_tenant', {
                    unit_id: unitId,
                    lead_id: leadId,
                    start_date: '2026-04-01',
                    monthly_rent: 12000,
                    security_deposit: 2500
                });
                const onboarded = await master.executeSubagentTool('CRMAgent', 'change_status', {
                    lead_id: leadId,
                    to_status: 'Onboarded',
                    reason: `Closed by ${actor.sales}`
                });
                expect(onboarded.status).toBe('Status Updated');
            } else {
                const invalid = await master.executeSubagentTool('CRMAgent', 'change_status', {
                    lead_id: leadId,
                    to_status: 'Onboarded',
                    reason: 'Attempt invalid skip'
                });
                expect(invalid.status).toBe('Invalid Transition');
            }
        };

        await Promise.all([
            runTenant('+919400000001', 'Tenant Parallel A', unit1.unit_id, {
                sales: 'Kalyani-A',
                caretaker: 'Caretaker-A',
                path: 'onboard_now'
            }),
            runTenant('+919400000002', 'Tenant Parallel B', unit2.unit_id, {
                sales: 'Kalyani-B',
                caretaker: 'Caretaker-B',
                path: 'pause'
            })
        ]);
    });
});
