const fs = require('fs');
const EventBus = require('../../server/src/master_ai/services/EventBus');

// Mock fs to prevent LogicEngine from doing real file I/O during tests
const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;
const originalMkdirSync = fs.mkdirSync;

fs.existsSync = (...args) => {
    if (String(args[0]).includes('workflows.json')) return false;
    return originalExistsSync.apply(fs, args);
};
fs.writeFileSync = (...args) => {
    if (String(args[0]).includes('workflows.json')) return;
    return originalWriteFileSync.apply(fs, args);
};
fs.mkdirSync = (...args) => {
    if (String(args[0]).includes('data')) return;
    return originalMkdirSync.apply(fs, args);
};

// Now require LogicEngine AFTER fs is mocked
const LogicEngine = require('../../server/src/master_ai/logic/LogicEngine');

class MockAgent {
    constructor(name, config = {}) {
        this.name = name;
        this.config = config; // { toolName: { mode: 'SUCCESS', delay: 0, response: {} } }
        this.calls = [];
    }

    async callTool(toolName, args) {
        this.calls.push({ tool: toolName, args, timestamp: new Date() });

        const toolConfig = this.config[toolName] || { mode: 'SUCCESS' };

        if (toolConfig.delay) {
            await new Promise(resolve => setTimeout(resolve, toolConfig.delay));
        }

        switch (toolConfig.mode) {
            case 'TIMEOUT':
                throw new Error(`[MockAgent:${this.name}] Timeout Sim for ${toolName}`);
            case 'EXCEPTION':
                throw new Error(`[MockAgent:${this.name}] Crash Sim for ${toolName}`);
            case 'INVALID_PAYLOAD':
                return "<html>Bad Gateway</html>";
            case 'SUCCESS':
            default:
                return toolConfig.response || { status: 'mock_success' };
        }
    }

    reset() {
        this.calls = [];
    }
}

class TestHarness {
    constructor() {
        this.eventBus = new EventBus();
        this.sessionService = {
            createOrUpdateSession: jest.fn(),
            getSession: jest.fn().mockReturnValue({ history: [] })
        };
        this.logicEngine = new LogicEngine(this.eventBus, this.sessionService);

        // Mock the executeStep method to redirect to our MockAgents
        this.logicEngine.executeStep = this.mockExecuteStep.bind(this);

        this.agents = {
            CRM: new MockAgent('CRM'),
            Property: new MockAgent('Property'),
            Finance: new MockAgent('Finance'),
            HR: new MockAgent('HR'),
            Chat: new MockAgent('Chat'),
            Admin: new MockAgent('Admin')
        };

        // Phase 2: Clock override
        this._systemTime = null;
        this.logicEngine._now = () => this.now();
    }

    // ========================================
    // Phase 1 APIs (unchanged)
    // ========================================

    async mockExecuteStep(step, context) {
        const [agentName, toolName] = step.tool.split('.');
        const agent = this.agents[agentName];

        if (!agent) {
            console.warn(`[TestHarness] Unknown agent ${agentName} for step ${step.name}`);
            return { error: 'Unknown Agent' };
        }

        console.log(`[TestHarness] Intercepting call to ${agentName}.${toolName}`);
        return await agent.callTool(toolName, step.args);
    }

    configureMock(agentName, toolName, config) {
        if (this.agents[agentName]) {
            this.agents[agentName].config[toolName] = config;
        }
    }

    getCallHistory(agentName) {
        return this.agents[agentName] ? this.agents[agentName].calls : [];
    }

    // ========================================
    // Phase 2A: Event Replay Mode
    // ========================================

    replayEvent(event) {
        // Re-inject event with same event_id through idempotent processing
        // Does NOT regenerate correlation_id
        const eventId = event.id || event.eventId;
        const workflowId = event.workflowId;
        const context = event.context || {};

        return this.logicEngine.processEvent(eventId, workflowId, context);
    }

    // ========================================
    // Phase 2B: Parallel Workflow Executor
    // ========================================

    async runParallel(configs) {
        // configs: [{ workflowId, context, eventId? }]
        // Start ALL workflows simultaneously, no sequential await
        const promises = configs.map(cfg => {
            if (cfg.eventId) {
                // Use idempotent processing
                const result = this.logicEngine.processEvent(cfg.eventId, cfg.workflowId, cfg.context || {});
                if (result.duplicate) {
                    return Promise.resolve(result.originalWorkflowId);
                }
                return result.instanceIdPromise;
            }
            return this.logicEngine.executeWorkflow(cfg.workflowId, cfg.context || {});
        });

        return Promise.all(promises);
    }

    // ========================================
    // Phase 2C: Clock Override
    // ========================================

    setSystemTime(timestamp) {
        this._systemTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    }

    advanceTime(ms) {
        if (this._systemTime === null) {
            this._systemTime = Date.now();
        }
        this._systemTime += ms;

        // Trigger any scheduled events and session expiry checks
        this.logicEngine.checkScheduledEvents();
    }

    now() {
        return this._systemTime !== null ? this._systemTime : Date.now();
    }

    // ========================================
    // Phase 2D: Snapshot State Extractor
    // ========================================

    getGlobalState() {
        // Deep clone via JSON for comparison safety
        return JSON.parse(JSON.stringify({
            workflows: this.logicEngine.workflows,
            activeWorkflows: this.logicEngine.activeWorkflows,
            agents: this._getAgentStates(),
            events: this.eventBus.eventHistory,
            locks: this.logicEngine.locks,
            sessions: this.logicEngine.sessions,
            processedEventIds: Array.from(this.logicEngine.processedEventIds.entries()),
            scheduledEvents: this.logicEngine.scheduledEvents
        }));
    }

    _getAgentStates() {
        const states = {};
        for (const [name, agent] of Object.entries(this.agents)) {
            states[name] = {
                calls: agent.calls.map(c => ({ tool: c.tool, args: c.args }))
            };
        }
        return states;
    }

    // ========================================
    // Utility: Reset all agents
    // ========================================

    resetAgents() {
        for (const agent of Object.values(this.agents)) {
            agent.reset();
        }
    }
}

module.exports = { TestHarness, MockAgent };
