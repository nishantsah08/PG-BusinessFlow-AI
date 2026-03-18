const MasterAI = require('../src/agents/MasterAI');
const CRMAgent = require('../src/agents/CRMAgent');
const HRAgent = require('../src/agents/HRAgent');
const PropertyAI = require('../src/agents/PropertyAI');
const FinanceAI = require('../src/agents/FinanceAI');

describe('MasterAI finance access policy', () => {
    let masterAI;
    let crmAgent;
    let hrAgent;
    let propertyAI;
    let financeAI;
    let staffRow;

    beforeEach(async () => {
        jest.resetModules();
        process.env.STORAGE_BACKEND = 'memory';
        process.env.OPENAI_API_KEY = 'test-key';

        crmAgent = new CRMAgent();
        hrAgent = new HRAgent();
        propertyAI = new PropertyAI();
        financeAI = new FinanceAI();
        masterAI = new MasterAI([crmAgent, hrAgent, propertyAI, financeAI]);

        const tenantId = 'tenant_finance_policy';
        const customerPhone = '+919800098000';

        const hired = await hrAgent.callTool('hire_staff', {
            tenant_id: tenantId,
            name: 'Parveen',
            designation: 'Caretaker',
            contact: {
                primary: '+919800001111',
                email: 'parveen@example.com',
            },
        });
        staffRow = await hrAgent.callTool('get_staff_details', {
            tenant_id: tenantId,
            staff_id: hired.staff_id,
        });

        await crmAgent.callTool('add_lead', {
            tenant_id: tenantId,
            name: 'Amit Sharma',
            primary_phone: customerPhone,
            email: 'amit@example.com',
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'Finance Policy' },
        });

        await propertyAI.callTool('add_property', {
            tenant_id: tenantId,
            name: 'Sunrise Residency',
            address: '12 Lake View Road, Pune',
            pin_code: '411014',
            area: 'Viman Nagar',
            city: 'Pune',
            state: 'Maharashtra',
            amenities: ['WiFi'],
            floors: 3,
        });
        await propertyAI.callTool('add_unit', {
            tenant_id: tenantId,
            property_id: 'PROP-1',
            unit_number: '101',
            floor: 1,
            types: ['Double Sharing'],
            base_rent: 12000,
            amenities: ['WiFi'],
            caretaker_staff_id: staffRow.id,
        });
        await propertyAI.callTool('assign_tenant', {
            tenant_id: tenantId,
            unit_id: 'UNIT-1',
            lead_id: customerPhone,
            start_date: '2026-03-01',
            monthly_rent: 12000,
            security_deposit: 2500,
        });

        await financeAI.callTool('onboard_tenant_contract', {
            tenant_id: tenantId,
            lead_id: customerPhone,
            negotiated_rent: 12000,
            security_deposit: 2500,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
            effective_from: '2026-03-01',
        });
        await financeAI.callTool('generate_monthly_bills', {
            tenant_id: tenantId,
            payer_id: customerPhone,
            month_year: 'Mar 2026',
        });
        await financeAI.callTool('record_incoming_txn', {
            tenant_id: tenantId,
            payer_id: customerPhone,
            amount: 6000,
            payment_mode: 'UPI',
        });

        masterAI.openai = {
            chat: {
                completions: {
                    create: jest.fn(async (payload) => ({
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: JSON.stringify({
                                    tools: payload.tools || [],
                                    systemPrompt: payload.messages?.find((message) => message.role === 'system')?.content || '',
                                }),
                            },
                        }],
                    })),
                },
            },
        };
    });

    it('gives CEO full finance tools in chat', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Show finance tools.' }],
            {
                tenant_id: 'tenant_finance_policy',
                profile_type: 'CEO',
                email: 'owner@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);
        expect(toolNames.some((name) => name.endsWith('_record_incoming_txn'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_financial_summary'))).toBe(true);
    });

    it('limits staff to assigned-unit finance reads plus initiation flows', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Help me with finance.' }],
            {
                tenant_id: 'tenant_finance_policy',
                profile_type: 'Staff',
                phone: '+919800001111',
                email: 'parveen@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);
        expect(toolNames.some((name) => name.endsWith('_get_assigned_unit_collection_statuses'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_record_incoming_txn'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_financial_summary'))).toBe(false);
        expect(parsed.systemPrompt).toContain('current-month collection details for units assigned');

        const scopedArgs = masterAI._scopeChatToolArgs(
            financeAI,
            'get_unit_collection_status',
            { unit_id: 'UNIT-1', tenant_id: 'tenant_finance_policy' },
            {
                role: 'Staff',
                ownStaffMember: staffRow,
            }
        );
        expect(scopedArgs.staff_id).toBe(staffRow.id);
    });

    it('limits customers to self finance scope', async () => {
        const ownLead = await crmAgent.callTool('get_lead_by_phone', {
            tenant_id: 'tenant_finance_policy',
            phone: '+919800098000',
        });
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Tell me my dues.' }],
            {
                tenant_id: 'tenant_finance_policy',
                profile_type: 'Customer',
                phone: '+919800098000',
                email: 'amit@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);
        expect(toolNames.some((name) => name.endsWith('_get_ledger'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_record_outgoing_txn'))).toBe(false);
        expect(parsed.systemPrompt).toContain('own dues');

        const scopedArgs = masterAI._scopeChatToolArgs(
            financeAI,
            'get_ledger',
            { tenant_id: 'tenant_finance_policy' },
            {
                role: 'Customer',
                ownCrmLead: ownLead.lead,
            }
        );
        expect(scopedArgs.payer_id).toBe('+919800098000');
    });

    it('builds full-system context for the SOP assistant from MasterAI', async () => {
        const workflow = masterAI._resolveFinanceWorkflow('generate_monthly_bills', 'tenant_finance_policy');
        const context = await masterAI.buildSopAssistantContext(workflow, {
            tenant_id: 'tenant_finance_policy',
            profile_type: 'CEO',
            email: 'owner@example.com',
        });

        expect(context.selected_sop.workflow_id).toBe(workflow.workflow_id);
        expect(context.visible_sops.counts.total).toBeGreaterThan(0);
        expect(context.hr.staff_count).toBeGreaterThan(0);
        expect(context.property.property_count).toBeGreaterThan(0);
        expect(context.property.unit_count).toBeGreaterThan(0);
        expect(context.finance.summary).toBeTruthy();
        expect(Array.isArray(context.crm.recent_leads)).toBe(true);
    });

    it('allows SOP validation over WhatsApp but blocks authoring there', async () => {
        const draft = masterAI._cloneWorkflowForTenant('finance_generate_monthly_bills_v1', 'tenant_finance_policy');

        const validationReply = await masterAI.chat(
            [{ role: 'user', content: 'Validate Generate Monthly Bills SOP.' }],
            {
                tenant_id: 'tenant_finance_policy',
                profile_type: 'CEO',
                email: 'owner@example.com',
                channel: 'whatsapp',
            }
        );

        expect(validationReply.content).toMatch(/sop validation/i);
        expect(validationReply.content).toMatch(new RegExp(draft.name, 'i'));
        expect(validationReply.content).toMatch(/ready to publish|needs correction/i);

        const editReply = await masterAI.chat(
            [{ role: 'user', content: 'Create a new SOP for move-out settlement.' }],
            {
                tenant_id: 'tenant_finance_policy',
                profile_type: 'CEO',
                email: 'owner@example.com',
                channel: 'whatsapp',
            }
        );

        expect(editReply.content).toMatch(/do not allow creating or changing sops here/i);
        expect(editReply.content).toMatch(/whatsapp environment is not conducive/i);
    });
});
