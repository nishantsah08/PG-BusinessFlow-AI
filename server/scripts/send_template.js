
require('dotenv').config({ path: '../.env' });
const CommunicationsAI = require('../src/agents/CommunicationsAI');

async function main() {
    console.log("Initializing CommunicationsAI...");
    const agent = new CommunicationsAI();

    const recipient = "+917559421424";
    const templateName = "v1_boys_en";

    console.log(`Sending template '${templateName}' to ${recipient}...`);

    try {
        const result = await agent.callTool('send_template_message', {
            recipient_phone: recipient,
            template_name: templateName,
            language_code: "en" // Assuming 'en' based on suffix, or default 'en_US'
        });

        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

main();
