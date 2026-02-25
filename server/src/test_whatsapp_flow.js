require('dotenv').config();
process.env.OPENAI_API_KEY = 'sk-mock-key';
const MasterAI = require('./agents/MasterAI');
const CRMAgent = require('./agents/CRMAgent');
const CommunicationsAI = require('./agents/CommunicationsAI');

// 1. Mock CommsAI
const commsAI = new CommunicationsAI();
commsAI.callTool = async (name, args) => {
    console.log(`[MOCK] CommsAI.${name} called with:`, JSON.stringify(args, null, 2));
    return { status: "Message Sent (Mock)" };
};

// 2. Mock CRMAgent (with In-Memory Store for verification)
const crmAgent = new CRMAgent();
crmAgent.leads = new Map(); // Reset leads correctly
crmAgent.timelines = new Map();

// Instantiate MasterAI
const masterAI = new MasterAI([commsAI, crmAgent]);

// 3. MOCK OpenAI Chat (Crucial for Dummy Data testing)
masterAI.chat = async (history) => {
    const lastMsg = history[history.length - 1].content;
    console.log(`[MOCK_LLM] Received history (Last: "${lastMsg}"). Generating dummy response...`);

    // Simulate Brain Logic
    if (lastMsg.includes('Hi')) return { role: 'assistant', content: 'Hello! How can I help?' };
    if (lastMsg.includes('2BHK')) return { role: 'assistant', content: 'Sure, we have 2BHKs available.' };
    return { role: 'assistant', content: 'I am a dummy brain.' };
};

async function runTest() {
    console.log("--- Starting Universal Message Flow Test (With Session) ---");

    const TEST_PHONE = 'WHATSAPP_TEST_User';

    // Step 1: Session Start (New User)
    console.log("\n[Step 1] User sends 'Hi' (New Session)");
    await masterAI.process_event({
        event_type: 'message.received',
        context: { channel: 'whatsapp' },
        payload: { from: TEST_PHONE, body: 'Hi, I am looking for a flat.', raw: { type: 'text' } }
    });

    // Check if Lead Created
    const lead = crmAgent.leads.get(TEST_PHONE);
    if (lead) console.log(`✓ Lead Created: ${lead.lead_id}`);
    else console.error("✗ Lead NOT Created");

    // Step 2: In-Session Chat (Memory Check)
    console.log("\n[Step 2] User sends '2BHK please' (Same Session)");
    await masterAI.process_event({
        event_type: 'message.received',
        context: { channel: 'whatsapp' },
        payload: { from: TEST_PHONE, body: '2BHK please', raw: { type: 'text' } }
    });

    console.log("\n[Step 2.5] User sends an image");
    await masterAI.process_event({
        event_type: 'message.received',
        context: { channel: 'whatsapp' },
        payload: {
            from: TEST_PHONE,
            body: null,
            media: { mime_type: "image/jpeg", id: "123" },
            raw: { type: 'image' }
        }
    });

    // Step 3: Simulate Timeout (Flush)
    console.log("\n[Step 3] Simulating 15m Timeout (Flush Session)");
    await masterAI.flushSession(TEST_PHONE);

    // Verify CRM Log
    const updatedLead = crmAgent.leads.get(TEST_PHONE);
    const timeline = crmAgent.timelines.get(TEST_PHONE);

    if (updatedLead && timeline) {
        const sessionLog = timeline.find(h => h.type === 'SESSION');
        if (sessionLog) {
            console.log("✓ Session Log Found in CRM Timeline:");
            console.log(JSON.stringify(sessionLog, null, 2));

            // Verify content (log_session receives summary not full messages in updated version)
            if (sessionLog.summary && sessionLog.summary.includes('messages')) {
                console.log("✓ Session summary is correct");
            } else {
                console.error("✗ Session summary mismatch");
            }

        } else {
            console.error("✗ Session Log Missing in CRM Timeline");
        }
    } else {
        console.error("✗ Lead Missing or Timeline Empty");
    }

    console.log("\n--- Test Complete ---");
    process.exit(0); // Force exit
}

runTest();
