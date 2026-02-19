const CommunicationsAI = require('../../server/src/agents/CommunicationsAI');
const MockWhatsAppProvider = require('./mocks/MockWhatsAppProvider');

async function prove() {
    console.log("=== SYSTEM RELIABILITY PROOF ===\n");
    const commsAI = new CommunicationsAI();
    const mockProvider = new MockWhatsAppProvider();

    // 1. Correlation Integrity Proof
    console.log("--- 1. Correlation Integrity Proof ---");
    const inboundPayload = mockProvider.createIncomingMessage("15551234567", "Start Conversation", "wamid.start");
    const inboundEvent = await commsAI.callTool('handle_incoming_message', { payload: inboundPayload });
    console.log("Step 1: Inbound Event Created");
    console.log(`Correlation ID: ${inboundEvent.correlation.correlation_id}`);
    console.log(`Conversation ID: ${inboundEvent.correlation.conversation_id}`);
    console.log(`Causation ID:     ${inboundEvent.correlation.causation_id}`);

    // Simulate Outbound Response carrying correlation
    const outboundResult = await commsAI.callTool('send_text_message', {
        recipient_phone: "15551234567",
        content: "Response",
        correlation_id: inboundEvent.correlation.correlation_id
    });
    console.log("\nStep 2: Outbound Response Sent");
    console.log(`Original Correlation ID Preserved: ${outboundResult.correlation_id}`);

    if (inboundEvent.correlation.correlation_id === outboundResult.correlation_id) {
        console.log("RESULT: PASS - Correlation ID persisted across flow.\n");
    } else {
        console.log("RESULT: FAIL - Correlation ID lost.\n");
    }


    // 2. Routing Enforcement Proof
    console.log("--- 2. Routing Enforcement Proof ---");
    // Priority & Sync/Async Check
    console.log(`Inbound Priority: ${inboundEvent.routing.priority} (Expected: critical)`);
    console.log(`Inbound Mode:     ${inboundEvent.routing.mode}     (Expected: async)`);
    console.log(`Inbound TTL:      ${inboundEvent.routing.ttl_ms}ms    (Expected: 5000)`);

    // Expired Event Rejection Check (Mocking old timestamp)
    const oldPayload = mockProvider.createIncomingMessage("15551234567", "Old Message", "wamid.old");
    // Manually mocking the timestamp in the adapter response (or we can inject it if mockProvider supports it)
    // Since MockProvider generates 'now', let's mock the adapter method return for this specific call or tool execution time
    // We will simulate the scenario by manually calling internal logic or mocking Date.now() if feasible.
    // Easier: Mock the handleIncomingMessage return to have old timestamp.

    // We'll rely on the logic check we just wrote: date > 5 mins.
    // Let's force an old timestamp in a fake payload if the adapter parses it. 
    // The adapter uses `entry[0].changes[0].value.messages[0].timestamp`.
    oldPayload.entry[0].changes[0].value.messages[0].timestamp = Math.floor(Date.now() / 1000) - 600; // 10 mins ago

    const expiredResult = await commsAI.callTool('handle_incoming_message', { payload: oldPayload });
    if (expiredResult.error === "Event rejected: Timestamp expired") {
        console.log("Expired Event Check: REJECTED (Expected)");
    } else {
        console.log("Expired Event Check: ACCEPTED (Fail)");
    }
    console.log("");

    // 3. Observability Proof
    console.log("--- 3. Observability Proof (Raw Log Sample) ---");
    console.log(JSON.stringify(inboundEvent.observability, null, 2));
    console.log(`Latency Checked: ${inboundEvent.observability.latency_ms}ms`);
    console.log("");


    // 4. Replay Safety Test
    console.log("--- 4. Replay Safety Test ---");
    console.log("Sending same webhook twice...");
    const event1 = await commsAI.callTool('handle_incoming_message', { payload: inboundPayload });
    const event2 = await commsAI.callTool('handle_incoming_message', { payload: inboundPayload });

    console.log(`Event 1 ID: ${event1.event_id}`);
    console.log(`Event 2 ID: ${event2.event_id}`);

    if (event1.event_id === event2.event_id) {
        console.log("RESULT: PASS - Deterministic ID generation (Idempotent).");
    } else {
        console.log("RESULT: FAIL - Different IDs generated for same source.");
    }
    console.log("");


    // 5. Failure Chain Test (Simulated)
    console.log("--- 5. Failure Chain Test ---");
    // We need to simulate: Send (Fail) -> Retry (Success) -> All with same Correlation ID.
    // Since we don't have a retry engine here (Router), we will simulate the *components* doing their part.
    // 1. Agent receives request with correlation_id.
    // 2. Mock Adapter fails.
    // 3. Agent reports failure (with correlation_id).
    // 4. Retry Logic (Router) calls Agent again with same correlation_id.
    // 5. Mock Adapter succeeds.
    // 6. Agent reports success (with correlation_id).

    const testCorrId = "corr_retry_test_999";

    // Attempt 1: Fail
    commsAI.whatsapp._send = async () => { throw { response: { data: { error: { message: "Simulated Network Error" } } } } };
    try {
        await commsAI.executeTool('send_text_message', { recipient_phone: "123", content: "Retry", correlation_id: testCorrId });
    } catch (e) {
        // In real agent, it returns error object, doesn't throw. Let's check `executeTool` wrapper...
        // wrapper calls internal method. internal method returns object or throws? 
        // Adapter returns {status: error} usually, but my mock overwrite threw. Use adapter convention.
    }
    // Let's use standard internal error handling of adapter
    // Overwrite _send to return error struct
    commsAI.whatsapp._send = async () => { return { status: "error", error: { message: "Simulated 500" } } };

    const failResult = await commsAI.callTool('send_text_message', { recipient_phone: "123", content: "Retry", correlation_id: testCorrId });
    console.log(`Attempt 1 (Fail): Status=${failResult.status}, Correlation=${failResult.correlation_id || testCorrId}`); // Wrapper passes it back if I added it to result. 
    // Wait, if adapter returns error, does my wrapper still append correlation_id? 
    // My wrapper: `const result = await ...; if (args.correlation_id) result.correlation_id = ...; return result;`
    // Yes, provided adapter returns an object.

    // Attempt 2: Success
    commsAI.whatsapp._send = async () => { return { status: "success", data: { messages: [{ id: "wamid.retry_success" }] } } };
    const successResult = await commsAI.callTool('send_text_message', { recipient_phone: "123", content: "Retry", correlation_id: testCorrId });
    console.log(`Attempt 2 (Success): Status=${successResult.status}, Correlation=${successResult.correlation_id}`);

    if (failResult.correlation_id === successResult.correlation_id && successResult.correlation_id === testCorrId) {
        console.log("RESULT: PASS - Correlation ID persisted through failure chain.");
    } else {
        console.log(`RESULT: FAIL - Correlation Mismatch (${failResult.correlation_id} vs ${successResult.correlation_id})`);
    }
}

prove().catch(console.error);
