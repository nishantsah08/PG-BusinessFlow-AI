const EventBus = require('./services/EventBus');
const SessionService = require('./services/SessionService');
const LogicEngine = require('./logic/LogicEngine');
const WebhookService = require('./services/WebhookService');

// Initialize Core Services
const eventBus = new EventBus();
const sessionService = new SessionService();
const logicEngine = new LogicEngine(eventBus, sessionService);
const webhookService = new WebhookService(eventBus, process.env.PORT || 4000);

console.log('--- MasterAI Agent System (Phase 1) ---');

// --- Setup Basic Event Handlers (Bootstrap) ---

// Example: Listen for new messages and trigger a simple workflow
eventBus.subscribe('message.received', async (event) => {
    console.log(`[MasterAI] Processing message event: ${event.id}`);

    // Simple logic: Is this a new user?
    const userId = event.payload.raw.from || 'unknown'; // extraction logic would be more complex
    const session = sessionService.createOrUpdateSession(userId, { lastActive: new Date() });

    console.log(`[MasterAI] Updated session for ${userId}`);

    // Trigger "Greeting" workflow if it exists
    // await logicEngine.executeWorkflow('greeting_flow', { userId });
});

// Start the Gateway
webhookService.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down MasterAI...');
    webhookService.stop();
    process.exit(0);
});

module.exports = {
    eventBus,
    sessionService,
    logicEngine,
    webhookService
};
