const MasterAI = require('../src/agents/MasterAI');
const CRMAgent = require('../src/agents/CRMAgent');
const HRAgent = require('../src/agents/HRAgent');
const PropertyAI = require('../src/agents/PropertyAI');

describe('MasterAI centralized chat access policy', () => {
    let masterAI;
    let crmAgent;
    let hrAgent;
    let propertyAI;

    beforeEach(async () => {
        process.env.STORAGE_BACKEND = 'memory';
        process.env.OPENAI_API_KEY = 'test-key';

        crmAgent = new CRMAgent();
        hrAgent = new HRAgent();
        propertyAI = new PropertyAI();
        masterAI = new MasterAI([crmAgent, hrAgent, propertyAI]);

        await hrAgent.callTool('hire_staff', {
            tenant_id: 'tenant_policy_test',
            name: 'Parveen',
            designation: 'Caretaker',
            contact: {
                primary: '+919800001111',
                email: 'parveen@example.com',
            },
        });

        await crmAgent.callTool('add_lead', {
            tenant_id: 'tenant_policy_test',
            name: 'Amit Sharma',
            primary_phone: '+919800098000',
            email: 'amit@example.com',
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'Policy Test' },
        });
        await crmAgent.callTool('add_lead', {
            tenant_id: 'tenant_policy_test',
            name: 'Neha Gupta',
            primary_phone: '+919811112222',
            email: 'neha@example.com',
            profile_type: 'Customer',
            source: { category: 'WhatsApp', detail: 'Policy Test' },
        });

        await propertyAI.callTool('add_property', {
            tenant_id: 'tenant_policy_test',
            name: 'Sunrise Residency',
            address: '12 Lake View Road, Pune',
            pin_code: '411014',
            area: 'Viman Nagar',
            city: 'Pune',
            state: 'Maharashtra',
            amenities: ['WiFi', 'Parking'],
            floors: 3,
        });
        await propertyAI.callTool('add_property', {
            tenant_id: 'tenant_policy_test',
            name: 'Maple Heights',
            address: '88 Hill Street, Pune',
            pin_code: '411001',
            area: 'Camp',
            city: 'Pune',
            state: 'Maharashtra',
            amenities: ['WiFi'],
            floors: 2,
        });
        await propertyAI.callTool('add_unit', {
            tenant_id: 'tenant_policy_test',
            property_id: 'PROP-1',
            unit_number: '101',
            floor: 1,
            types: ['Double Sharing'],
            base_rent: 12000,
            amenities: ['WiFi', 'Parking'],
        });
        await propertyAI.callTool('add_unit', {
            tenant_id: 'tenant_policy_test',
            property_id: 'PROP-1',
            unit_number: '102',
            floor: 1,
            types: ['Single Sharing'],
            base_rent: 14000,
            amenities: ['WiFi'],
        });
        await propertyAI.callTool('add_unit', {
            tenant_id: 'tenant_policy_test',
            property_id: 'PROP-2',
            unit_number: '201',
            floor: 2,
            types: ['Double Sharing'],
            base_rent: 11500,
            amenities: ['WiFi'],
        });
        await propertyAI.callTool('assign_tenant', {
            tenant_id: 'tenant_policy_test',
            unit_id: 'UNIT-1',
            lead_id: '+919800098000',
            start_date: '2026-03-01',
            monthly_rent: 12000,
            security_deposit: 2500,
        });
        await propertyAI.callTool('assign_tenant', {
            tenant_id: 'tenant_policy_test',
            unit_id: 'UNIT-3',
            lead_id: '+919811112222',
            start_date: '2026-03-02',
            monthly_rent: 11500,
            security_deposit: 2500,
        });

        await new Promise((resolve) => setTimeout(resolve, 0));

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

    it('gives CEO full HR, CRM, and Property tool visibility', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Show all details.' }],
            {
                tenant_id: 'tenant_policy_test',
                profile_type: 'CEO',
                email: 'owner@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);

        expect(toolNames).toContain('HRAgent_get_all_staff');
        expect(toolNames).toContain('CRMAgent_search_leads');
        expect(toolNames).toContain('PropertyAI_update_unit');
    });

    it('gives staff self-HR, operational CRM, and read-only Property tools', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Help me with operations.' }],
            {
                tenant_id: 'tenant_policy_test',
                profile_type: 'Staff',
                phone: '+919800001111',
                email: 'parveen@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);

        expect(toolNames.some((name) => name.endsWith('_get_staff_details'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_all_staff'))).toBe(false);
        expect(toolNames.some((name) => name.endsWith('_search_leads'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_change_status'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_merge_leads'))).toBe(false);
        expect(toolNames.some((name) => name.endsWith('_get_units'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_update_unit'))).toBe(false);
        expect(parsed.systemPrompt).toContain('read-only operational property tools only');
    });

    it('limits customers to self CRM and public or own property visibility', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Tell me about my booking.' }],
            {
                tenant_id: 'tenant_policy_test',
                profile_type: 'Customer',
                phone: '+919800098000',
                email: 'amit@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);

        expect(toolNames.some((name) => name.endsWith('_get_staff_details'))).toBe(false);
        expect(toolNames.some((name) => name.endsWith('_search_leads'))).toBe(false);
        expect(toolNames.some((name) => name.endsWith('_get_lead'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_timeline'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_units'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_public_rate_card'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_update_unit'))).toBe(false);
        expect(parsed.systemPrompt).toContain('own CRM profile');
        expect(parsed.systemPrompt).toContain('own booking-linked property context');
    });

    it('sanitizes customer property results to public units plus own booking only', async () => {
        const units = await propertyAI.callTool('get_units', {
            tenant_id: 'tenant_policy_test',
        });
        const sanitized = masterAI._sanitizeChatToolResult(
            propertyAI,
            'get_units',
            units,
            {
                role: 'Customer',
                ownCrmLead: { lead_id: '+919800098000' },
            }
        );

        expect(Array.isArray(sanitized)).toBe(true);
        const unitNumbers = sanitized.map((unit) => unit.unit_number);

        expect(unitNumbers).toContain('101');
        expect(unitNumbers).toContain('102');
        expect(unitNumbers).not.toContain('201');
        expect(sanitized[0].tenant_id).toBeUndefined();
        expect(sanitized[0].can_delete).toBeUndefined();
    });
});
