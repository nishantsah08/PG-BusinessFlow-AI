const MasterAI = require('../../../server/src/agents/MasterAI');
const CRMAgent = require('../../../server/src/agents/CRMAgent');
const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('Session Context Loading (MasterAI)', () => {
    let masterAI;
    let crmAgent;

    beforeAll(() => {
        process.env.OPENAI_API_KEY = 'mock-test-key';
    });

    beforeEach(async () => {
        crmAgent = new CRMAgent();
        const propertyAI = new PropertyAI();
        masterAI = new MasterAI([propertyAI, crmAgent]);

        // Mock OpenAI to return the raw messages (for prompt inspection)
        masterAI.openai = {
            chat: {
                completions: {
                    create: jest.fn(async (payload) => {
                        return {
                            choices: [{ message: { role: 'assistant', content: JSON.stringify(payload.messages) } }]
                        };
                    })
                }
            }
        };

        // Seed a known lead with some sessions
        await crmAgent.callTool('add_lead', {
            name: 'Rahul Sharma',
            primary_phone: '+919800098000',
            email: 'rahul@gmail.com',
            source: { category: 'WhatsApp', detail: null }
        });

        // Add 5 SESSION events to the timeline
        for (let i = 1; i <= 5; i++) {
            await crmAgent.callTool('log_session', {
                lead_id: '+919800098000',
                interaction_type: 'WhatsApp Conversation',
                participants: ['+919800098000', 'MasterAI'],
                summary: `Test conversation ${i} about rooms`,
                sentiment: i <= 3 ? 'Positive' : 'Neutral',
                tone: 'Casual'
            });
        }
    });

    afterEach(() => {
        // Clear session timeouts
        if (masterAI.sessions) {
            for (const [key, session] of masterAI.sessions) {
                clearTimeout(session.timeoutId);
            }
            masterAI.sessions.clear();
        }
    });

    // --- Happy Path Tests ---

    test('CTX-01: Known user by phone → leadContext populated', async () => {
        const session = await masterAI.getOrCreateSession('+919800098000');
        expect(session.leadContext).not.toBeNull();
        expect(session.leadContext.name).toBe('Rahul Sharma');
        expect(session.leadId).toBe('+919800098000');
        expect(session.leadContext.isTemporary).toBeUndefined();
    });

    test('CTX-02: Known user by email → leadContext populated', async () => {
        const session = await masterAI.getOrCreateSession({ email: 'rahul@gmail.com' });
        expect(session.leadContext).not.toBeNull();
        expect(session.leadContext.name).toBe('Rahul Sharma');
        expect(session.leadContext.isTemporary).toBeUndefined();
    });

    test('CTX-03: Known user → recentSessions has ≤3 SESSION events', async () => {
        const session = await masterAI.getOrCreateSession('+919800098000');
        expect(Array.isArray(session.recentSessions)).toBe(true);
        expect(session.recentSessions.length).toBeLessThanOrEqual(3);
    });

    test('CTX-04: Known user with 5 sessions → only last 3 returned', async () => {
        const session = await masterAI.getOrCreateSession('+919800098000');
        expect(session.recentSessions.length).toBe(3);
        // Should be the most recent 3 (sessions 3, 4, 5 based on chronological order)
    });

    test('CTX-05: Unknown phone → temp lead created (isTemporary=true), no CRM write', async () => {
        const unknownPhone = '+919999999999';

        // Verify the phone doesn't exist in CRM
        const preCheck = await crmAgent.callTool('get_lead_by_phone', { phone: unknownPhone });
        expect(preCheck.status).toBe('Not Found');

        const session = await masterAI.getOrCreateSession(unknownPhone);
        expect(session.leadContext).not.toBeNull();
        expect(session.leadContext.isTemporary).toBe(true);
        expect(session.leadId).toBeNull();

        // Verify no CRM lead was created
        const postCheck = await crmAgent.callTool('get_lead_by_phone', { phone: unknownPhone });
        expect(postCheck.status).toBe('Not Found');
    });

    test('CTX-06: Temp lead + business-relevant conversation → flush creates CRM lead', async () => {
        const unknownPhone = '+919888888888';
        const session = await masterAI.getOrCreateSession(unknownPhone);
        clearTimeout(session.timeoutId);

        // Simulate conversation messages
        session.messages = [
            { role: 'user', content: 'Hi, I am looking for a single room near Koregaon Park' },
            { role: 'assistant', content: 'Welcome! We have single rooms available starting at ₹10,000/month.' },
            { role: 'user', content: 'Great, can I visit this Saturday? My name is Priya.' }
        ];

        // Mock OpenAI to return business-relevant classification
        masterAI.openai.chat.completions.create.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        is_business_relevant: true,
                        reason: 'Room enquiry with visit scheduling',
                        extracted_name: 'Priya',
                        summary: 'Customer enquired about single rooms near Koregaon Park, wants to visit Saturday.',
                        sentiment: 'Positive',
                        tone: 'Casual'
                    })
                }
            }]
        });

        await masterAI.flushSession(unknownPhone);

        // Verify CRM lead was now created
        const check = await crmAgent.callTool('get_lead_by_phone', { phone: unknownPhone });
        expect(check.status).toBe('Found');
        expect(check.lead.name).toBe('Priya');
    });

    test('CTX-07: Temp lead + irrelevant conversation → no CRM write', async () => {
        const unknownPhone = '+919777777777';
        const session = await masterAI.getOrCreateSession(unknownPhone);
        clearTimeout(session.timeoutId);

        session.messages = [
            { role: 'user', content: 'Sorry wrong number' },
            { role: 'assistant', content: 'No worries! Have a great day.' }
        ];

        // Mock OpenAI to return not-relevant classification
        masterAI.openai.chat.completions.create.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        is_business_relevant: false,
                        reason: 'Wrong number, no business intent',
                        extracted_name: null,
                        summary: 'User sent a message to the wrong number.',
                        sentiment: 'Neutral',
                        tone: 'Casual'
                    })
                }
            }]
        });

        await masterAI.flushSession(unknownPhone);

        // Verify NO CRM lead was created
        const check = await crmAgent.callTool('get_lead_by_phone', { phone: unknownPhone });
        expect(check.status).toBe('Not Found');
    });

    test('CTX-08: Existing session → no re-lookup on 2nd message', async () => {
        const session1 = await masterAI.getOrCreateSession('+919800098000');
        const session2 = await masterAI.getOrCreateSession('+919800098000');
        // Should be the exact same session object (no re-lookup)
        expect(session1).toBe(session2);
    });

    // --- Failure Policy Tests ---

    test('CTX-F01: get_lead_by_email throws → session proceeds without CRM context', async () => {
        // Mock CRM email lookup to throw
        const origCallTool = crmAgent.callTool.bind(crmAgent);
        crmAgent.callTool = jest.fn(async (toolName, args) => {
            if (toolName === 'get_lead_by_email') {
                throw new Error('CRM service unavailable');
            }
            return origCallTool(toolName, args);
        });

        // Session via email should not crash
        const session = await masterAI.getOrCreateSession({ email: 'crash@test.com' });
        expect(session).toBeDefined();
        expect(session.leadContext).toBeDefined();
        expect(session.leadContext.isTemporary).toBe(true);
    });

    test('CTX-F02: get_timeline throws → session has empty recentSessions', async () => {
        // Mock CRM timeline to throw
        const origCallTool = crmAgent.callTool.bind(crmAgent);
        crmAgent.callTool = jest.fn(async (toolName, args) => {
            if (toolName === 'get_timeline') {
                throw new Error('Timeline service unavailable');
            }
            return origCallTool(toolName, args);
        });

        const session = await masterAI.getOrCreateSession('+919800098000');
        expect(session.leadContext).not.toBeNull();
        expect(session.leadContext.name).toBe('Rahul Sharma');
        // recentSessions should be empty due to graceful degradation
        expect(session.recentSessions).toEqual([]);
    });

    test('CTX-F03: Flush LLM classification throws → session dropped, no CRM write, no crash', async () => {
        const unknownPhone = '+919666666666';
        const session = await masterAI.getOrCreateSession(unknownPhone);
        clearTimeout(session.timeoutId);

        session.messages = [
            { role: 'user', content: 'I need a room' }
        ];

        // Mock OpenAI to throw
        masterAI.openai.chat.completions.create.mockRejectedValueOnce(new Error('OpenAI API timeout'));

        // Should not crash
        await expect(masterAI.flushSession(unknownPhone)).resolves.toBeUndefined();

        // No CRM lead should exist
        const check = await crmAgent.callTool('get_lead_by_phone', { phone: unknownPhone });
        expect(check.status).toBe('Not Found');
    });

    test('CTX-F04: Flush LLM succeeds but add_lead throws → flush.failed event emitted', async () => {
        const unknownPhone = '+919555555555';
        const session = await masterAI.getOrCreateSession(unknownPhone);
        clearTimeout(session.timeoutId);

        session.messages = [
            { role: 'user', content: 'I want to book a double sharing room' }
        ];

        // Mock OpenAI to return business-relevant
        masterAI.openai.chat.completions.create.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        is_business_relevant: true,
                        reason: 'Room booking request',
                        extracted_name: 'Test User',
                        summary: 'User wants to book a double sharing room.',
                        sentiment: 'Positive',
                        tone: 'Formal'
                    })
                }
            }]
        });

        // Mock CRM add_lead to throw
        const origCallTool = crmAgent.callTool.bind(crmAgent);
        crmAgent.callTool = jest.fn(async (toolName, args) => {
            if (toolName === 'add_lead') {
                throw new Error('CRM write failed');
            }
            return origCallTool(toolName, args);
        });

        // Capture system events
        const events = [];
        masterAI.on('system_event', (event) => events.push(event));

        await masterAI.flushSession(unknownPhone);

        // Should have emitted flush.failed event
        const failedEvent = events.find(e => e.event_type === 'flush.failed');
        expect(failedEvent).toBeDefined();
        expect(failedEvent.payload.error).toBe('CRM write failed');
        expect(failedEvent.payload.verdict.is_business_relevant).toBe(true);
        expect(failedEvent.payload.messages.length).toBe(1);
    });

    test('CTX-F05: Flush has zero retries on any failed CRM call', async () => {
        const unknownPhone = '+919444444444';
        const session = await masterAI.getOrCreateSession(unknownPhone);
        clearTimeout(session.timeoutId);

        session.messages = [
            { role: 'user', content: 'Looking for accommodation' }
        ];

        // Mock OpenAI to return business-relevant
        masterAI.openai.chat.completions.create.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        is_business_relevant: true,
                        reason: 'Accommodation search',
                        extracted_name: null,
                        summary: 'User looking for accommodation.',
                        sentiment: 'Neutral',
                        tone: 'Casual'
                    })
                }
            }]
        });

        // Count CRM add_lead calls
        const addLeadCalls = [];
        const origCallTool = crmAgent.callTool.bind(crmAgent);
        crmAgent.callTool = jest.fn(async (toolName, args) => {
            if (toolName === 'add_lead') {
                addLeadCalls.push({ toolName, args });
                throw new Error('CRM unavailable');
            }
            return origCallTool(toolName, args);
        });

        await masterAI.flushSession(unknownPhone);

        // Should have exactly 1 add_lead call (zero retries)
        expect(addLeadCalls.length).toBe(1);
    });
});
