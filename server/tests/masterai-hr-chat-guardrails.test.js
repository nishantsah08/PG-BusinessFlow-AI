const MasterAI = require('../src/agents/MasterAI');
const CRMAgent = require('../src/agents/CRMAgent');
const HRAgent = require('../src/agents/HRAgent');

describe('MasterAI HR chat guardrails', () => {
    let masterAI;

    beforeEach(async () => {
        process.env.STORAGE_BACKEND = 'memory';
        process.env.OPENAI_API_KEY = 'test-key';

        const crmAgent = new CRMAgent();
        const hrAgent = new HRAgent();
        masterAI = new MasterAI([crmAgent, hrAgent]);

        await hrAgent.callTool('hire_staff', {
            tenant_id: 'tenant_guardrail_test',
            name: 'Parveen',
            designation: 'Caretaker',
            contact: {
                primary: '+919800001111',
                email: 'parveen@example.com',
            },
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

    it('keeps HR roster tools for CEO only', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Show me the HR roster.' }],
            {
                tenant_id: 'tenant_guardrail_test',
                profile_type: 'CEO',
                email: 'owner@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);

        expect(toolNames).toContain('HRAgent_get_all_staff');
        expect(toolNames).toContain('HRAgent_get_staff_details');
    });

    it('limits staff to their own HR tools only', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Show my HR details.' }],
            {
                tenant_id: 'tenant_guardrail_test',
                profile_type: 'Staff',
                phone: '+919800001111',
                email: 'parveen@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);

        expect(toolNames.some((name) => name.endsWith('_get_staff_details'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_salary_card'))).toBe(true);
        expect(toolNames.some((name) => name.endsWith('_get_all_staff'))).toBe(false);
        expect(parsed.systemPrompt).toContain("only access and reveal this staff member's own HR details");
    });

    it('treats non-staff CRM users as customers even if they have an email address', async () => {
        const response = await masterAI.chat(
            [{ role: 'user', content: 'Show the employee roster.' }],
            {
                tenant_id: 'tenant_guardrail_test',
                profile_type: 'Customer',
                phone: '+919800009999',
                email: 'customer@example.com',
            }
        );

        const parsed = JSON.parse(response.content);
        const toolNames = parsed.tools.map((tool) => tool.function.name);

        expect(toolNames.some((name) => name.endsWith('_get_all_staff'))).toBe(false);
        expect(toolNames.some((name) => name.endsWith('_get_staff_details'))).toBe(false);
        expect(parsed.systemPrompt).toContain('STRICT IDENTITY GUARDRAIL');
    });
});
