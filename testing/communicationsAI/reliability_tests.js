const CommunicationsAI = require('../../server/src/agents/CommunicationsAI');
const MockWhatsAppProvider = require('./mocks/MockWhatsAppProvider');

// Mock axios - we don't need actual calls for this, just payload structure of the return
jest.mock('axios');

describe('Communications AI System Reliability Layer', () => {
    let commsAI;
    let mockProvider;

    beforeEach(() => {
        commsAI = new CommunicationsAI();
        mockProvider = new MockWhatsAppProvider();
        jest.clearAllMocks();
    });

    // --- IR1: Correlation Persistence ---
    test('IR1: Inbound event should start correlation chain', async () => {
        const payload = mockProvider.createIncomingMessage("15550001234", "New Conversation", "wamid.123");

        const event = await commsAI.executeTool('handle_incoming_message', { payload });

        expect(event.correlation).toBeDefined();
        expect(event.correlation.correlation_id).toMatch(/^corr_/);
        expect(event.correlation.causation_id).toBe("wamid.123");
        expect(event.correlation.conversation_id).toBe("conv_15550001234");
    });

    // --- IR2: Routing Metadata ---
    test('IR2: Inbound message should be Critical priority', async () => {
        const payload = mockProvider.createIncomingMessage("15550001234", "Urgent", "wamid.456");

        const event = await commsAI.executeTool('handle_incoming_message', { payload });

        expect(event.routing).toBeDefined();
        expect(event.routing.priority).toBe('critical');
        expect(event.routing.ttl_ms).toBe(5000);
    });

    // --- IR3: Observability ---
    test('IR3: Event should contain observability timestamps', async () => {
        const payload = mockProvider.createIncomingMessage("15550001234", "Ping", "wamid.789");

        const event = await commsAI.executeTool('handle_incoming_message', { payload });

        expect(event.observability).toBeDefined();
        expect(event.observability.received_at).toBeDefined();
        expect(event.observability.processed_at).toBeDefined();
        expect(event.observability.latency_ms).toBeGreaterThanOrEqual(0);
    });

    // --- IR1/2: Delivery Status Event Structure ---
    test('IR1/2: Delivery status should have correct metadata', async () => {
        const payload = mockProvider.createDeliveryStatus("15550001234", "wamid.123", "delivered");

        const event = await commsAI.executeTool('handle_delivery_status', { payload });

        expect(event.event_type).toBe('message.status');
        expect(event.correlation.causation_id).toBe("wamid.123");
        expect(event.routing.priority).toBe('low'); // Status updates are lower priority
        expect(event.observability).toBeDefined();
    });

    // --- Structure Compliance ---
    test('Schema: Event should match Canonical Event Schema', async () => {
        const payload = mockProvider.createIncomingMessage("15550001234", "Schema Check", "wamid.schema");
        const event = await commsAI.executeTool('handle_incoming_message', { payload });

        const requiredKeys = ['event_id', 'event_type', 'event_version', 'timestamp', 'source', 'target', 'routing', 'correlation', 'auth', 'context', 'payload', 'observability'];

        requiredKeys.forEach(key => {
            expect(event).toHaveProperty(key);
        });

        expect(event.source.name).toBe("WhatsAppAdapter");
        expect(event.target.name).toBe("Router");
    });
});
