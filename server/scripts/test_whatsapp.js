
require('dotenv').config({ path: '../.env' }); // Adjust path to .env
const CommunicationsAI = require('../src/agents/CommunicationsAI');

async function main() {
    console.log("Initializing CommunicationsAI...");
    const agent = new CommunicationsAI();

    const recipient = "+917588498834";
    const message = "Hi";

    console.log(`Sending '${message}' to ${recipient}...`);

    try {
        const result = await agent.callTool('send_text_message', {
            recipient_phone: recipient,
            content: message
        });

        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

main();
