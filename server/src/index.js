require('dotenv').config();
const express = require('express');
const cors = require('cors');
const MasterAI = require('./agents/MasterAI');
const { PropertyAI, CRMAgent, HRAgent, FinanceAI, CommunicationsAI } = require('./agents/BlankAgents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Agents
const propertyAI = new PropertyAI();
const crmAgent = new CRMAgent();
const hrAgent = new HRAgent();
const financeAI = new FinanceAI();
const commsAI = new CommunicationsAI();

// Master AI knows about everyone else
const masterAI = new MasterAI([propertyAI, crmAgent, hrAgent, financeAI, commsAI]);

const allAgents = [masterAI, propertyAI, crmAgent, hrAgent, financeAI, commsAI];

// Routes

// 1. Get Agent Status (for Developer View)
app.get('/api/agents', (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json(statuses);
});

// 2. Chat with Master AI
app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    if (!messages) return res.status(400).json({ error: "No messages provided" });

    try {
        const response = await masterAI.chat(messages);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
