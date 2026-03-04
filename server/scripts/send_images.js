
require('dotenv').config({ path: '../.env' });
const CommunicationsAI = require('../src/agents/CommunicationsAI');

async function main() {
    console.log("Initializing CommunicationsAI...");
    const agent = new CommunicationsAI();

    const recipient = "+917588498834";
    const images = [
        "WhatsApp Image 2025-09-25 at 13.24.31_d5e118ea.jpg",
        "WhatsApp Image 2025-09-25 at 13.24.34_44444e2d.jpg"
    ];

    for (const image of images) {
        const imageUrl = `http://localhost:3001/images/${image}`;
        console.log(`Sending image ${image} to ${recipient}...`);

        try {
            const result = await agent.callTool('send_media_message', {
                recipient_phone: recipient,
                media_type: 'image',
                media_url: imageUrl,
                caption: `Sent from server: ${image}`
            });

            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
}

main();
