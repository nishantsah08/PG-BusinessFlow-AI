const MasterAI = require('../../../server/src/agents/MasterAI');
const PropertyAI = require('../../../server/src/agents/PropertyAI');
const CRMAgent = require('../../../server/src/agents/CRMAgent');

describe('Identity-Based Guardrails (MasterAI)', () => {
    let masterAI;
    let mockSessionManager;

    beforeAll(() => {
        // Mock OpenAI API key to bypass initialization error
        process.env.OPENAI_API_KEY = 'mock-test-key';

        // Initialize with dummy subagents to test the system prompt mapping
        const propertyAI = new PropertyAI();
        const crmAgent = new CRMAgent();
        masterAI = new MasterAI([propertyAI, crmAgent]);

        // Mock OpenAI call to return the raw messages sent to it, allowing us to inspect the generated prompt
        masterAI.openai = {
            chat: {
                completions: {
                    create: jest.fn(async (payload) => {
                        // We intercept the payload to verify the system prompt
                        return {
                            choices: [{ message: { role: 'assistant', content: JSON.stringify(payload.messages) } }]
                        };
                    })
                }
            }
        };
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GRD-01: Anonymous/External User (No email) -> Internal Architecture Hidden', async () => {
        const history = [{ role: 'user', content: 'Who is on your team?' }];
        const response = await masterAI.chat(history, null); // userContext = null

        const payloadMessages = JSON.parse(response.content);
        const systemPrompt = payloadMessages.find(m => m.role === 'system').content;

        // The prompt should NOT contain the CEO override
        expect(systemPrompt).not.toContain('CEO OVERRIDE GRANTED');

        // The prompt MUST contain the strict guardrail
        expect(systemPrompt).toContain('STRICT IDENTITY GUARDRAIL');
        expect(systemPrompt).toContain('must NOT mention internal tools');
        expect(systemPrompt).toContain('Act as a unified, singular human representative named Kalyani');
    });

    test('GRD-02: Non-CEO Staff User (Email & WhatsApp) -> STAFF MODE (Not CEO Override)', async () => {
        const history = [{ role: 'user', content: 'What are the names of the AI agents?' }];

        // Test via Email Dashboard Context
        const userContextEmail = { email: 'staff@example.com' };
        const responseEmail = await masterAI.chat(history, userContextEmail);
        const payloadMessagesEmail = JSON.parse(responseEmail.content);
        const systemPromptEmail = payloadMessagesEmail.find(m => m.role === 'system').content;

        // Staff now get STAFF MODE, not STRICT IDENTITY GUARDRAIL
        expect(systemPromptEmail).not.toContain('CEO OVERRIDE GRANTED');
        expect(systemPromptEmail).toContain('STAFF MODE');

        // Test via WhatsApp CRM Context
        const userContextWhatsApp = { profile_type: 'Staff', name: 'Sales Rep' };
        const responseWhatsApp = await masterAI.chat(history, userContextWhatsApp);
        const payloadMessagesWhatsApp = JSON.parse(responseWhatsApp.content);
        const systemPromptWhatsApp = payloadMessagesWhatsApp.find(m => m.role === 'system').content;

        expect(systemPromptWhatsApp).not.toContain('CEO OVERRIDE GRANTED');
        expect(systemPromptWhatsApp).toContain('STAFF MODE');
    });

    test('GRD-03: CEO User (Email & WhatsApp) -> Internal Architecture Exposed', async () => {
        const history = [{ role: 'user', content: 'Tell me about the subagents.' }];

        // Test via Email Dashboard Context
        const userContextEmail = { email: 'nishantsah@outlook.in' };
        const responseEmail = await masterAI.chat(history, userContextEmail);
        const payloadMessagesEmail = JSON.parse(responseEmail.content);
        const systemPromptEmail = payloadMessagesEmail.find(m => m.role === 'system').content;

        // The prompt MUST contain the CEO override and internal transparency
        expect(systemPromptEmail).toContain('CEO OVERRIDE GRANTED');
        expect(systemPromptEmail).toContain('You MAY openly discuss your internal system architecture');
        expect(systemPromptEmail).toContain('Your Internal Sub-Agent Team:');
        expect(systemPromptEmail).toContain('Inventory & Asset Manager (PropertyAI)');
        expect(systemPromptEmail).not.toContain('STRICT IDENTITY GUARDRAIL');
        expect(systemPromptEmail).not.toContain('STAFF MODE');

        // Test via WhatsApp CRM Context
        const userContextWhatsApp = { profile_type: 'CEO', name: 'Nishant Sah' };
        const responseWhatsApp = await masterAI.chat(history, userContextWhatsApp);
        const payloadMessagesWhatsApp = JSON.parse(responseWhatsApp.content);
        const systemPromptWhatsApp = payloadMessagesWhatsApp.find(m => m.role === 'system').content;

        expect(systemPromptWhatsApp).toContain('CEO OVERRIDE GRANTED');
        expect(systemPromptWhatsApp).toContain('Your Internal Sub-Agent Team:');
        expect(systemPromptWhatsApp).not.toContain('STRICT IDENTITY GUARDRAIL');
        expect(systemPromptWhatsApp).not.toContain('STAFF MODE');
    });

    test('GRD-04: Staff user → system prompt contains STAFF MODE operational access', async () => {
        const history = [{ role: 'user', content: 'What is the current occupancy?' }];
        const userContext = { profile_type: 'Staff' };
        const response = await masterAI.chat(history, userContext);
        const payloadMessages = JSON.parse(response.content);
        const systemPrompt = payloadMessages.find(m => m.role === 'system').content;

        expect(systemPrompt).toContain('STAFF MODE');
        expect(systemPrompt).toContain('occupancy rates');
        expect(systemPrompt).toContain('pending maintenance');
        expect(systemPrompt).toContain('task lists');
    });

    test('GRD-05: Staff user → system prompt does NOT contain AI architecture', async () => {
        const history = [{ role: 'user', content: 'Tell me about your AI system' }];
        const userContext = { profile_type: 'Staff' };
        const response = await masterAI.chat(history, userContext);
        const payloadMessages = JSON.parse(response.content);
        const systemPrompt = payloadMessages.find(m => m.role === 'system').content;

        expect(systemPrompt).not.toContain('CEO OVERRIDE GRANTED');
        expect(systemPrompt).not.toContain('Sub-Agent Team');
        expect(systemPrompt).toContain('must NOT reveal AI architecture');
    });

    test('GRD-06: Customer user → system prompt contains specific share/don\'t-share rules', async () => {
        const history = [{ role: 'user', content: 'Hi' }];
        const response = await masterAI.chat(history, null); // null = anonymous customer
        const payloadMessages = JSON.parse(response.content);
        const systemPrompt = payloadMessages.find(m => m.role === 'system').content;

        expect(systemPrompt).toContain('STRICT IDENTITY GUARDRAIL');
        expect(systemPrompt).toContain('pricing');
        expect(systemPrompt).toContain('amenities');
        expect(systemPrompt).toContain('must NOT share');
        expect(systemPrompt).toContain('other tenants');
    });

    test('GRD-07: Known user with history → system prompt contains Recent Conversation History', async () => {
        const history = [{ role: 'user', content: 'Any update?' }];
        const userContext = {
            profile_type: 'Customer',
            recentSessions: [
                { timestamp: '2026-02-20T12:00:00Z', summary: 'Confirmed booking for B-204.', sentiment: 'Positive' },
                { timestamp: '2026-02-05T10:00:00Z', summary: 'Complained about noise.', sentiment: 'Negative' }
            ]
        };
        const response = await masterAI.chat(history, userContext);
        const payloadMessages = JSON.parse(response.content);
        const systemPrompt = payloadMessages.find(m => m.role === 'system').content;

        expect(systemPrompt).toContain('Recent Conversation History');
        expect(systemPrompt).toContain('Confirmed booking for B-204.');
        expect(systemPrompt).toContain('Complained about noise.');
        expect(systemPrompt).toContain('Positive');
        expect(systemPrompt).toContain('Negative');
    });
});
