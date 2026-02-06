require('dotenv').config();
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
crmAgent.leads = []; // Reset leads

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
        type: 'WHATSAPP_MESSAGE',
        payload: { from: TEST_PHONE, text: 'Hi, I am looking for a flat.', source: 'WhatsApp' }
    });

    // Check if Lead Created
    const lead = crmAgent.leads.find(l => l.phones.primary === TEST_PHONE);
    if (lead) console.log(`✓ Lead Created: ${lead.lead_id}`);
    else console.error("✗ Lead NOT Created");

    // Step 2: In-Session Chat (Memory Check)
    console.log("\n[Step 2] User sends '2BHK please' (Same Session)");
    await masterAI.process_event({
        type: 'WHATSAPP_MESSAGE',
        payload: { from: TEST_PHONE, text: '2BHK please', source: 'WhatsApp' }
    });

    // Step 3: Simulate Timeout (Flush)
    console.log("\n[Step 3] Simulating 15m Timeout (Flush Session)");
    await masterAI.flushSession(TEST_PHONE);

    // Verify CRM Log
    const updatedLead = crmAgent.leads.find(l => l.phones.primary === TEST_PHONE);

    if (updatedLead && updatedLead.history) {
        const sessionLog = updatedLead.history.find(h => h.type === 'SESSION');
        if (sessionLog) {
            console.log("✓ Session Log Found in CRM History:");
            console.log(JSON.stringify(sessionLog, null, 2));

            // Verify content
            if (sessionLog.messages.length >= 4) {
                console.log("✓ Session has correct number of messages (User+Bot, User+Bot)");
            } else {
                console.error("✗ Session message count mismatch: " + sessionLog.messages.length);
            }

        } else {
            console.error("✗ Session Log Missing in CRM History");
        }
    } else {
        console.error("✗ Lead Missing or History Empty");
    }

    console.log("\n--- Test Complete ---");
    process.exit(0); // Force exit
}

runTest();
