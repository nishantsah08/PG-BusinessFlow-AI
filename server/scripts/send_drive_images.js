
require('dotenv').config({ path: '../.env' });
const CommunicationsAI = require('../src/agents/CommunicationsAI');

async function main() {
    console.log("Initializing CommunicationsAI...");
    const agent = new CommunicationsAI();

    const recipient = "+917588498834";
    const images = [
        {
            url: "https://drive.google.com/uc?export=view&id=1TWCDEnrJJQ27tL_blQvtKb4Kss9LCJfM",
            caption: "Building view.jpg (from Google Drive)"
        },
        {
            url: "https://drive.google.com/uc?export=view&id=1OWPx6TNxT5jlSumfT78Zo0SQOT9_5PfM",
            caption: "Double bunk.jpeg (from Google Drive)"
        }
    ];

    for (const image of images) {
        console.log(`Sending image ${image.caption} to ${recipient}...`);

        try {
            const result = await agent.callTool('send_media_message', {
                recipient_phone: recipient,
                media_type: 'image',
                media_url: image.url,
                caption: image.caption
            });

            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
}

main();
