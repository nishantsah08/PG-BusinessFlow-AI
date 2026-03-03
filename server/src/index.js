require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const MasterAI = require('./agents/MasterAI');
const PropertyAI = require('./agents/PropertyAI');
const CRMAgent = require('./agents/CRMAgent');
const HRAgent = require('./agents/HRAgent');
const FinanceAI = require('./agents/FinanceAI');
const CommunicationsAI = require('./agents/CommunicationsAI');
const TimeAuthorityService = require('./services/TimeAuthorityService');
const WorkflowStore = require('./storage/WorkflowStore');
const ImageStore = require('./storage/ImageStore');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;
const APP_ENV = process.env.APP_ENV || 'development';
const IS_PROD = APP_ENV === 'production';
const ALLOW_DEBUG_ENDPOINTS = !IS_PROD && process.env.ALLOW_DEBUG_ENDPOINTS !== 'false';
const upload = multer({ storage: multer.memoryStorage() });
const googleTokenCache = new Map();

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

const corsOptions = IS_PROD && process.env.CORS_ORIGIN
    ? { origin: process.env.CORS_ORIGIN }
    : {};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
    const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
});

const path = require('path');
const fs = require('fs');
const IMAGE_DIR = path.join(__dirname, '..', '..', 'images');
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'local';
const workflowStore = new WorkflowStore({ backend: STORAGE_BACKEND });
const imageStore = new ImageStore({ backend: STORAGE_BACKEND, imageDir: IMAGE_DIR });

app.use('/images', express.static(IMAGE_DIR));

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        app: 'PG-BusinessFlow.ai',
        env: APP_ENV,
        timestamp: TimeAuthorityService.nowIST()
    });
});

app.get('/ready', (_req, res) => {
    const missing = [];
    const required = ['OPENAI_API_KEY'];
    if (IS_PROD) {
        required.push('WEBHOOK_VERIFY_TOKEN');
        required.push('WHATSAPP_PHONE_NUMBER_ID');
    }
    required.forEach((k) => {
        if (!process.env[k]) missing.push(k);
    });
    if (missing.length > 0) {
        return res.status(503).json({ status: 'not_ready', missing });
    }
    return res.json({ status: 'ready', env: APP_ENV });
});

async function verifyGoogleToken(idToken) {
    const cached = googleTokenCache.get(idToken);
    if (cached && cached.exp > Date.now()) return cached.payload;

    const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { id_token: idToken },
        timeout: 5000
    });
    const payload = response.data;
    if (!payload || payload.email_verified !== 'true') {
        throw new Error('Unverified Google identity');
    }
    const expMs = (Number(payload.exp || 0) * 1000) || (Date.now() + 300000);
    googleTokenCache.set(idToken, { payload, exp: expMs });
    return payload;
}

async function requireAuth(req, res, next) {
    if (!IS_PROD) return next();
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ success: false, error: 'Missing bearer token' });
        const payload = await verifyGoogleToken(token);

        const authMode = (process.env.GOOGLE_AUTH_MODE || 'internal').toLowerCase();
        const allowedDomain = process.env.GOOGLE_AUTH_ALLOWED_DOMAIN;
        const allowedEmailsRaw = process.env.GOOGLE_AUTH_ALLOWED_EMAILS || '';
        const allowedEmails = new Set(
            allowedEmailsRaw
                .split(',')
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean)
        );
        const email = String(payload.email || '').toLowerCase();
        const emailDomain = email.includes('@') ? email.split('@')[1] : '';
        const hasInternalRules = Boolean(allowedDomain) || allowedEmails.size > 0;

        if (authMode === 'internal') {
            if (!hasInternalRules) {
                return res.status(503).json({
                    success: false,
                    error: 'GOOGLE_AUTH_MODE=internal requires GOOGLE_AUTH_ALLOWED_DOMAIN or GOOGLE_AUTH_ALLOWED_EMAILS'
                });
            }
            const domainAllowed = allowedDomain ? emailDomain === String(allowedDomain).toLowerCase() : false;
            const emailAllowed = allowedEmails.size > 0 ? allowedEmails.has(email) : false;
            if (!domainAllowed && !emailAllowed) {
                return res.status(403).json({ success: false, error: 'Authenticated user is not authorized for internal mode' });
            }
        } else if (authMode !== 'public') {
            return res.status(503).json({ success: false, error: 'Invalid GOOGLE_AUTH_MODE. Use internal or public' });
        }

        req.authUser = {
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture || null,
            type: 'Google'
        };
        return next();
    } catch (_err) {
        return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }
}

function requireDebugAccess(req, res, next) {
    if (!ALLOW_DEBUG_ENDPOINTS) {
        return res.status(403).json({ success: false, error: 'Debug endpoints are disabled in production mode' });
    }
    return next();
}

// Image upload endpoint — saves files to disk and returns accessible URLs
app.post('/api/upload/images', requireAuth, upload.array('images', 20), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files provided' });
        }
        const urls = [];
        for (const f of req.files) {
            urls.push(imageStore.saveBuffer(f.buffer, f.originalname, 'prop'));
        }
        res.json({ success: true, data: { urls } });
    } catch (error) {
        console.error('Image Upload Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
app.get('/api/system/events/stream', requireDebugAccess, (req, res) => {
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
app.get('/api/agents', requireDebugAccess, (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json({ success: true, data: { agents: statuses } });
});
app.get('/api/system/agents', requireDebugAccess, (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json({ success: true, data: { agents: statuses } });
});

// 2. Chat with Master AI
const chatHandler = async (req, res) => {
    try {
        // Handle FormData fields that were stringified on the frontend
        let message = req.body.message;
        let messages = req.body.messages;
        let user = req.body.user;

        console.log('[ChatHandler] req.files:', req.files ? req.files.length + ' file(s)' : 'none');
        console.log('[ChatHandler] body keys:', Object.keys(req.body));

        if (typeof messages === 'string') messages = JSON.parse(messages);
        if (typeof user === 'string') user = JSON.parse(user);
        if (IS_PROD && req.authUser) user = req.authUser;

        let inputMessages = messages;
        if (message && !messages) {
            inputMessages = [{ role: 'user', content: message }];
        }

        // Handle uploaded files — save to disk and inject accessible URLs
        if (req.files && req.files.length > 0 && inputMessages && inputMessages.length > 0) {
            const savedUrls = [];

            for (const f of req.files) {
                console.log('[ChatHandler] File received:', f.fieldname, f.originalname, f.mimetype, f.size + ' bytes');
                if (f.mimetype.startsWith('image/')) {
                    // Save to disk (Phase 1: local file storage per implementation_plan.md)
                    const savedUrl = imageStore.saveBuffer(f.buffer, f.originalname, 'chat_upload');
                    savedUrls.push(savedUrl);
                }
            }

            // Append image URLs directly to the user's message text so the LLM can't miss them
            if (savedUrls.length > 0) {
                console.log('[ChatHandler] Saved URLs:', savedUrls);
                const lastMsg = inputMessages[inputMessages.length - 1];
                const urlList = savedUrls.join(', ');
                const imageNote = `\n\n[Attached ${savedUrls.length} image(s) — use these as image_urls: ${urlList}]`;
                if (typeof lastMsg.content === 'string') {
                    lastMsg.content += imageNote;
                } else if (Array.isArray(lastMsg.content)) {
                    // Find the text part and append
                    const textPart = lastMsg.content.find(p => p.type === 'text');
                    if (textPart) textPart.text += imageNote;
                    else lastMsg.content.push({ type: 'text', text: imageNote });
                }
                console.log('[ChatHandler] Last message content after injection:', typeof lastMsg.content === 'string' ? lastMsg.content.substring(0, 500) : 'array');
            }
        }

        if (!inputMessages) return res.status(400).json({ error: "No messages provided" });

        const normalizedEvent = await commsAI.callTool('handle_portal_message', {
            messages: inputMessages,
            user,
            correlation_id: req.correlationId
        });

        const response = await masterAI.chat(
            normalizedEvent.payload?.history || inputMessages,
            normalizedEvent.context?.user || user
        );
        res.json({ success: true, data: response });
    } catch (error) {
        console.error("Chat Handler Error:", error);
        res.status(500).json({ error: error.message });
    }
};

app.post('/api/communications/chat', requireAuth, upload.any(), chatHandler);

// 2.1 Get MasterAI Events
app.get('/api/master_ai/events', requireAuth, (req, res) => {
    res.json({ success: true, data: { events: [...recentEvents].reverse().slice(0, req.query.limit || 20) } });
});

// 2.2 Get MasterAI Trace
app.get('/api/master_ai/trace/:id', requireAuth, (req, res) => {
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
app.post('/api/system/agent/control', requireAuth, requireDebugAccess, (req, res) => {
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

// 2.4 Property API Route (Direct Tool Access) - LEGACY (To be deprecated)
app.post('/api/property/tools/:tool_name', requireAuth, async (req, res) => {
    try {
        const toolName = req.params.tool_name;
        // Verify tool exists in propertyAI
        if (!propertyAI.capabilities.tools.includes(toolName)) {
            return res.status(404).json({ success: false, error: `Tool ${toolName} not found or not allowed` });
        }
        const result = await propertyAI.callTool(toolName, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error(`Property Tool Error [${req.params.tool_name}]:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.4.1 Master AI - Execute SubAgent Tool (New Architectural Standard)
app.post('/api/master_ai/tools/execute', requireAuth, async (req, res) => {
    try {
        const { agent_name, tool_name, parameters } = req.body;

        if (!agent_name || !tool_name) {
            return res.status(400).json({ success: false, error: 'agent_name and tool_name are required.' });
        }

        console.log(`[API] Dashboard requested MasterAI to execute ${agent_name}.${tool_name}`);

        const result = await masterAI.executeSubagentTool(agent_name, tool_name, parameters || {});
        res.json({ success: true, data: result });
    } catch (error) {
        console.error(`[API] MasterAI Tool Execution Error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── 2.5 Workflow Definitions CRUD ───────────────────────────────────
// GET /api/workflows — list all
app.get('/api/workflows', requireAuth, (req, res) => {
    try {
        const workflows = workflowStore.list();
        res.json({ success: true, data: { workflows } });
    } catch (error) {
        console.error('Workflow List Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/workflows/:id — get single
app.get('/api/workflows/:id', requireAuth, (req, res) => {
    try {
        const wf = workflowStore.getById(req.params.id);
        if (!wf) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        res.json({ success: true, data: wf });
    } catch (error) {
        console.error('Workflow Get Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/workflows — create new
app.post('/api/workflows', requireAuth, (req, res) => {
    try {
        const { workflow_id, name, description, trigger_event, steps } = req.body;
        if (!workflow_id || !trigger_event || !steps) {
            return res.status(400).json({ success: false, error: 'Missing required fields: workflow_id, trigger_event, steps' });
        }

        const workflows = workflowStore.list();
        if (workflows.find(w => w.workflow_id === workflow_id)) {
            return res.status(409).json({ success: false, error: `Workflow '${workflow_id}' already exists` });
        }

        const newWorkflow = {
            workflow_id,
            name: name || '',
            description: description || '',
            trigger_event,
            steps: steps || [],
            created_at: TimeAuthorityService.nowIST()
        };
        workflows.push(newWorkflow);
        workflowStore.saveAll(workflows);

        console.log(`[Workflows] Created: ${workflow_id}`);
        res.status(201).json({ success: true, data: newWorkflow });
    } catch (error) {
        console.error('Workflow Create Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/workflows/:id — update existing
app.put('/api/workflows/:id', requireAuth, (req, res) => {
    try {
        const workflows = workflowStore.list();
        const idx = workflows.findIndex(w => w.workflow_id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }

        const { name, description, trigger_event, steps } = req.body;
        if (name !== undefined) workflows[idx].name = name;
        if (description !== undefined) workflows[idx].description = description;
        if (trigger_event !== undefined) workflows[idx].trigger_event = trigger_event;
        if (steps !== undefined) workflows[idx].steps = steps;
        workflows[idx].updated_at = TimeAuthorityService.nowIST();

        workflowStore.saveAll(workflows);
        console.log(`[Workflows] Updated: ${req.params.id}`);
        res.json({ success: true, data: workflows[idx] });
    } catch (error) {
        console.error('Workflow Update Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/workflows/:id — delete
app.delete('/api/workflows/:id', requireAuth, (req, res) => {
    try {
        let workflows = workflowStore.list();
        const idx = workflows.findIndex(w => w.workflow_id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }

        const deleted = workflows.splice(idx, 1)[0];
        workflowStore.saveAll(workflows);
        console.log(`[Workflows] Deleted: ${req.params.id}`);
        res.json({ success: true, data: deleted });
    } catch (error) {
        console.error('Workflow Delete Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Verify OpenAI (Test Endpoint)
app.get('/api/verify-openai', requireAuth, async (req, res) => {
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
        console.log('Incoming Webhook: received payload', {
            object: req.body?.object || null,
            entries: Array.isArray(req.body?.entry) ? req.body.entry.length : 0
        });

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
