require('dotenv').config();
const express = require('express');
const cors = require('cors');
const MasterAI = require('./agents/MasterAI');
const PropertyAI = require('./agents/PropertyAI');
const CRMAgent = require('./agents/CRMAgent');
const HRAgent = require('./agents/HRAgent');
const FinanceAI = require('./agents/FinanceAI');
const CommunicationsAI = require('./agents/CommunicationsAI');
const TimeAuthorityService = require('./services/TimeAuthorityService');

const app = express();
const PORT = process.env.PORT || 3001;

// Startup Check
try {
    require('fs').writeFileSync('startup.txt', 'Fresh Run Server Started at ' + TimeAuthorityService.nowIST());

    // Redirect Console to File
    const fs = require('fs');
    const util = require('util');
    const logFile = fs.createWriteStream('server.log', { flags: 'a' });
    const logStdout = process.stdout;
    console.log = function () {
        logFile.write(util.format.apply(null, arguments) + '\n');
        logStdout.write(util.format.apply(null, arguments) + '\n');
    }
    console.error = function () {
        logFile.write(util.format.apply(null, arguments) + '\n');
        logStdout.write(util.format.apply(null, arguments) + '\n');
    }

    console.log('Startup Check: File written successfully.');
} catch (e) {
    console.error('Startup Check Failed:', e);
}

app.use(cors());
app.use(express.json());
app.use('/images', express.static('../../images'));

// Initialize Agents
const propertyAI = new PropertyAI();
const crmAgent = new CRMAgent();
const hrAgent = new HRAgent({ crmAgent: crmAgent });
const financeAI = new FinanceAI();
const commsAI = new CommunicationsAI();

// Master AI knows about everyone else
const masterAI = new MasterAI([propertyAI, crmAgent, hrAgent, financeAI, commsAI]);

const allAgents = [masterAI, propertyAI, crmAgent, hrAgent, financeAI, commsAI];

// SSE Event Clients
let sseClients = [];
let recentEvents = [];

// Subscribe to MasterAI internal events
masterAI.on('system_event', (event) => {
    recentEvents.push(event);
    if (recentEvents.length > 50) recentEvents.shift();

    // Forward to all connected SSE clients
    sseClients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
});

// Periodic heartbeat to keep connections alive
setInterval(() => {
    sseClients.forEach(client => {
        client.res.write(`event: ping\ndata: {"time": "${TimeAuthorityService.nowIST()}"}\n\n`);
    });
}, 20000);

// Routes

// 0. System Event Stream (SSE)
app.get('/api/system/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send an initial connection event
    res.write(`data: ${JSON.stringify({ event_type: 'stream.connected', timestamp: TimeAuthorityService.nowIST() })}\n\n`);

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    console.log(`[SSE] Client connected: ${clientId} (${sseClients.length} total)`);

    req.on('close', () => {
        console.log(`[SSE] Client disconnected: ${clientId}`);
        sseClients = sseClients.filter(client => client.id !== clientId);
    });
});

// 1. Get Agent Status (for Developer View)
app.get('/api/agents', (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json({ success: true, data: { agents: statuses } });
});
app.get('/api/system/agents', (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json({ success: true, data: { agents: statuses } });
});

// 2. Chat with Master AI
const chatHandler = async (req, res) => {
    const { message, messages, user } = req.body;
    let inputMessages = messages;
    if (message && !messages) {
        inputMessages = [{ role: 'user', content: message }];
    }
    if (!inputMessages) return res.status(400).json({ error: "No messages provided" });

    try {
        const response = await masterAI.chat(inputMessages, user);
        res.json({ success: true, data: response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

app.post('/api/chat', chatHandler);
app.post('/api/master_ai/chat', chatHandler);

// 2.1 Get MasterAI Events
app.get('/api/master_ai/events', (req, res) => {
    res.json({ success: true, data: { events: [...recentEvents].reverse().slice(0, req.query.limit || 20) } });
});

// 2.2 Get MasterAI Trace
app.get('/api/master_ai/trace/:id', (req, res) => {
    // Return a mock trace since we don't persist them locally
    res.json({
        success: true,
        data: {
            plan: "Execution Plan Generated",
            sub_tasks: [
                { agent: "PropertyAI", instruction: "Analyzed request for properties", status: "completed" }
            ]
        }
    });
});

// 2.3 Agent Control API
app.post('/api/system/agent/control', (req, res) => {
    try {
        const { agent_name, action } = req.body;

        if (!agent_name || !action) {
            return res.status(400).json({ success: false, error: 'Missing agent_name or action' });
        }

        const agent = allAgents.find(a => a.name === agent_name);

        if (!agent) {
            return res.status(404).json({ success: false, error: `Agent ${agent_name} not found` });
        }

        switch (action) {
            case 'enable':
                if (typeof agent.enable === 'function') {
                    agent.enable();
                } else {
                    agent.status = 'online';
                }
                console.log(`[Agent Control] Enabled ${agent_name}, status is now ${agent.status}`);
                break;
            case 'disable':
                if (typeof agent.disable === 'function') {
                    agent.disable();
                } else {
                    agent.status = 'offline';
                }
                console.log(`[Agent Control] Disabled ${agent_name}, status is now ${agent.status}`);
                break;
            case 'restart':
                if (typeof agent.restart === 'function') {
                    agent.restart();
                } else {
                    agent.status = 'offline';
                    setTimeout(() => { agent.status = 'online'; }, 1000);
                }
                console.log(`[Agent Control] Restarted ${agent_name}, status will change shortly`);
                break;
            default:
                return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
        }

        res.json({ success: true, status: agent.status || 'unknown' });
    } catch (error) {
        console.error('Agent Control Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Verify OpenAI (Test Endpoint)
app.get('/api/verify-openai', async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ status: 'error', message: 'Missing OPENAI_API_KEY' });
    }
    try {
        // Simple ping
        const result = await masterAI.chat([{ role: "user", content: "Ping. Are you active?" }]);
        res.json({ status: 'success', response: result.content });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 4. WhatsApp Webhook (Verification)
app.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 5. WhatsApp Webhook (Incoming Events)
app.post('/api/webhooks/whatsapp', async (req, res) => {
    try {
        console.log('Incoming Webhook:', JSON.stringify(req.body, null, 2));

        // Route through Communications AI System Reliability Layer
        const systemEvent = await commsAI.callTool('handle_incoming_message', { payload: req.body });

        if (systemEvent) {
            console.log('System Event Generated:', JSON.stringify(systemEvent, null, 2));

            // Forward canonical event to MasterAI
            // Check if it's an error object first
            if (systemEvent.error) {
                console.error('Event Rejected by CommsAI:', systemEvent.error);
                // We still return 200 to Meta to avoid retry loops for bad payloads
            } else {
                await masterAI.process_event(systemEvent);
            }
            res.sendStatus(200);
        } else {
            // It might be a status update or unhandled type
            // Try status handler
            const statusEvent = await commsAI.callTool('handle_delivery_status', { payload: req.body });
            if (statusEvent) {
                console.log('Status Event Generated:', JSON.stringify(statusEvent, null, 2));
                await masterAI.process_event(statusEvent);
                res.sendStatus(200);
            } else {
                // Not a recognized message or status, but return 200 to Meta
                res.sendStatus(200);
            }
        }
    } catch (error) {
        console.error('Webhook Error:', error);
        res.sendStatus(500);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
