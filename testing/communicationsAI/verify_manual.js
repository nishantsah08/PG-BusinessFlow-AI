const CommunicationsAI = require('../../server/src/agents/CommunicationsAI');
const MockWhatsAppProvider = require('./mocks/MockWhatsAppProvider');

async function run() {
    console.log("Starting Manual Verification...");

    try {
        const commsAI = new CommunicationsAI();
        const mockProvider = new MockWhatsAppProvider();

        // 1. Test Inbound Webhook Parsing
        console.log("Test 1: Inbound Webhook Parsing");
        const payload = mockProvider.createIncomingMessage("15550001234", "Hello Manual", "wamid.manual001");
        const event = await commsAI.callTool('handle_incoming_message', { payload });

        if (event && event.type === 'message.received' && event.body === 'Hello Manual') {
            const hasReliability = event.event_id && event.correlation && event.routing && event.observability;
            const hasLatency = event.observability.latency_ms >= 0;

            if (hasReliability && hasLatency) {
                console.log("PASS: Inbound webhook parsed correctly with Reliability Layer.");
                console.log(`   - Correlation ID: ${event.correlation.correlation_id}`);
                console.log(`   - Latency: ${event.observability.latency_ms}ms`);
            } else {
                console.error("FAIL: Reliability Layer missing in inbound event.", event);
            }
        } else {
            console.error("FAIL: Inbound webhook parsing failed.", event);
        }

        // 2. Test Outbound Message (Mocking internal adapter method call if possible, or reliance on axios mock which is harder here)
        // Since we can't easily mock axios in a plain script without extra libs, we'll skip the actual network call verification 
        // and assume the adapter logic is correct if it doesn't crash.
        // Or we can overwrite the _send method of the adapter instance.
        console.log("Test 2: Outbound Message Logic");
        commsAI.whatsapp._send = async (endpoint, data) => {
            console.log(`Mocked Send to ${endpoint}:`, data);
            return { status: "success", data: { messages: [{ id: "wamid.mockDefaults" }] } };
        };

        const result = await commsAI.callTool('send_text_message', {
            recipient_phone: "15550001234",
            content: "Manual Outbound Test"
        });

        if (result.status === "success") {
            console.log("PASS: Outbound message logic executed.");
        } else {
            console.error("FAIL: Outbound message logic failed.", result);
        }

        console.log("Manual Verification Complete.");

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
    }
}

run();
