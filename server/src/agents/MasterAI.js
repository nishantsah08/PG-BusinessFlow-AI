const BaseAgent = require('./BaseAgent');
const OpenAI = require('openai');
const PhoneNormalizationService = require('../services/PhoneNormalizationService');
const TimeAuthorityService = require('../services/TimeAuthorityService');
const DateFormatterService = require('../services/DateFormatterService');
const BusinessConfig = require('../config/business');
const WorkflowStore = require('../storage/WorkflowStore');
const {
    FINANCIAL_MUTATION_TOOL_TO_WORKFLOW,
    ensurePredefinedFinancialWorkflows,
    isProtectedPredefinedWorkflow
} = require('../workflows/financialWorkflowPolicy');

const workflowStore = new WorkflowStore({ backend: process.env.STORAGE_BACKEND || 'local' });

class MasterAI extends BaseAgent {
    constructor(otherAgents = []) {
        super({
            name: 'MasterAI',
            identity: {
                systemName: 'MasterAI',
                personaName: 'Kalyani',
                role: 'Head of Operations & Sales (Orchestrator)',
                description: 'You are Kalyani. You look after the entire business operations and sales. You are the central coordinator. You do not do the "work" yourself but delegate it to your team (Property, CRM, etc.).'
            },
            capabilities: {
                skills: ['Orchestration', 'Task Delegation', 'Sales Strategy', 'Operations Oversight'],
                tools: ['delegate_to_agent', 'define_workflow', 'update_workflow'],
                triggers: ['Receives events from Communications AI', 'Directly from the Portal Chat Window']
            },
            directives: {
                goals: ['Fulfill user requests efficiently', 'Maintain system stability', 'Coordinate team using predefined workflows'],
                constraints: ['Never make up information', 'Always trust specialist agents']
            },
            hierarchy: {
                subAgents: otherAgents
            }
        });

        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Session Manager: Map<PhoneNumber, ConversationSession>
        this.sessions = new Map();
        this.SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes
        this.financeAuthorizationRequests = new Map();

        ensurePredefinedFinancialWorkflows(workflowStore);

        this._setupSelfTools();
    }

    _isFinanceMutationTool(agentName, toolName) {
        return agentName === 'FinanceAI' && !!FINANCIAL_MUTATION_TOOL_TO_WORKFLOW[toolName];
    }

    _resolveWorkflowParams(templateParams = {}, context = {}) {
        const resolved = {};
        Object.entries(templateParams).forEach(([key, value]) => {
            if (typeof value === 'string') {
                const match = value.match(/^\{\{context\.([a-zA-Z0-9_]+)\}\}$/);
                if (match) {
                    const ctxKey = match[1];
                    if (context[ctxKey] !== undefined) {
                        resolved[key] = context[ctxKey];
                    }
                    return;
                }
            }
            resolved[key] = value;
        });
        return resolved;
    }

    _isCeoApprover(identity) {
        if (!identity) return false;
        const ceoEmail = (BusinessConfig.persona?.ceo_email || '').toLowerCase();
        const ceoPhone = BusinessConfig.persona?.ceo_phone;
        return String(identity).toLowerCase() === ceoEmail || identity === ceoPhone;
    }

    _createFinanceAuthorizationRequest(toolName, args, workflowId, source) {
        const authorization_id = `FIN-AUTH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const request = {
            authorization_id,
            workflow_id: workflowId,
            tool_name: toolName,
            args: { ...(args || {}) },
            source,
            requested_by: args?.requested_by || 'Kalyani',
            requested_by_role: args?.requested_by_role || 'Sales',
            status: 'PENDING_CEO_AUTHORIZATION',
            created_at: TimeAuthorityService.nowIST(),
            decided_at: null,
            decided_by: null
        };
        this.financeAuthorizationRequests.set(authorization_id, request);
        return request;
    }

    async _executeDeterministicFinanceWorkflow(toolName, args, source = 'chat') {
        const workflowId = FINANCIAL_MUTATION_TOOL_TO_WORKFLOW[toolName];
        if (!workflowId) {
            throw new Error(`No deterministic workflow mapping found for FinanceAI.${toolName}`);
        }

        const workflow = workflowStore.getById(workflowId);
        if (!workflow) {
            throw new Error(`Predefined workflow '${workflowId}' not found for FinanceAI.${toolName}`);
        }

        const step = (workflow.steps || []).find(s => s.agent === 'FinanceAI' && s.tool === toolName);
        if (!step) {
            throw new Error(`Workflow '${workflowId}' does not define FinanceAI.${toolName}`);
        }

        if (args?.ceo_authorized !== true) {
            const pending = this._createFinanceAuthorizationRequest(toolName, args, workflowId, source);
            this._emitSystemEvent('workflow.authorization_requested', null, {
                workflow_id: workflowId,
                authorization_id: pending.authorization_id,
                requested_by: pending.requested_by,
                requested_by_role: pending.requested_by_role,
                tool: toolName,
                source
            });
            return {
                status: 'PENDING_CEO_AUTHORIZATION',
                workflow_id: workflowId,
                authorization_id: pending.authorization_id,
                message: toolName === 'record_incoming_txn'
                    ? 'Incoming payment requires CEO bank-statement confirmation before posting.'
                    : 'Financial workflow requires CEO authorization before execution.'
            };
        }

        if (!this._isCeoApprover(args?.approved_by)) {
            return {
                status: 'REJECTED',
                workflow_id: workflowId,
                error: 'Only CEO can authorize financial workflow completion.'
            };
        }

        const financeArgs = this._resolveWorkflowParams(step.params || {}, args || {});
        const financeAgent = this.subAgents.find(a => a.name === 'FinanceAI');
        if (!financeAgent) {
            throw new Error('FinanceAI not connected to MasterAI');
        }

        this._emitSystemEvent('workflow.started', null, { workflow_id: workflowId, source });
        const result = await financeAgent.callTool(toolName, financeArgs);
        this._emitSystemEvent('workflow.ended', null, { workflow_id: workflowId, source });

        return {
            ...result,
            workflow_id: workflowId,
            deterministic: true
        };
    }

    _setupSelfTools() {
        this.registerTool('define_workflow', 'Creates a new operational workflow definition. Use this to codify a business process into a structured sequence of agent delegations.', {
            type: "object",
            properties: {
                workflow_id: { type: "string", description: "Unique identifier in snake_case, e.g. onboard_tenant" },
                name: { type: "string", description: "A beautiful, human-readable title (e.g., 'Property Enquiry Processing')" },
                description: { type: "string", description: "A natural language paragraph explaining the entire workflow context" },
                trigger_event: { type: "string", description: "Event that triggers this workflow, e.g. payment.received" },
                trigger_description: { type: "string", description: "Natural language description of when the workflow should trigger, e.g. When a new property enquiry comes in." },
                steps: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            step_id: { type: "string" },
                            description: { type: "string", description: "A detailed natural language sentence explaining what this step does and why, to be shown to the CEO." },
                            agent: { type: "string", description: "Name of the sub-agent, e.g. CRMAgent, PropertyAI" },
                            tool: { type: "string", description: "Name of the tool to execute" },
                            params: { type: "object", description: "Parameters to pass to the tool" },
                            on_failure: { type: "string", enum: ["retry", "compensate", "abort"] }
                        },
                        required: ["step_id", "agent", "tool", "params", "on_failure"]
                    }
                },
                validation_rules: { type: "object" }
            },
            required: ["workflow_id", "description", "trigger_event", "steps"]
        }, async (args) => {
            if (isProtectedPredefinedWorkflow(args.workflow_id)) {
                return { success: false, error: `Workflow '${args.workflow_id}' is system-protected and cannot be replaced.` };
            }
            const workflows = workflowStore.list();
            if (workflows.find(w => w.workflow_id === args.workflow_id)) {
                return { success: false, error: `Workflow '${args.workflow_id}' already exists. Use update_workflow instead.` };
            }
            const newWorkflow = {
                workflow_id: args.workflow_id,
                name: args.name || '',
                description: args.description || '',
                trigger_event: args.trigger_event,
                trigger_description: args.trigger_description || '',
                steps: args.steps,
                created_at: TimeAuthorityService.nowIST()
            };
            workflows.push(newWorkflow);
            workflowStore.saveAll(workflows);
            this._emitSystemEvent('workflow.defined', null, { workflow_id: args.workflow_id });
            return { success: true, message: `Workflow '${args.workflow_id}' created successfully.` };
        });

        this.registerTool('update_workflow', 'Updates an existing operational workflow definition. Use this when the user asks to modify a process.', {
            type: "object",
            properties: {
                workflow_id: { type: "string", description: "Unique identifier of the workflow to update" },
                name: { type: "string" },
                description: { type: "string" },
                trigger_event: { type: "string" },
                trigger_description: { type: "string" },
                steps: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            step_id: { type: "string" },
                            description: { type: "string" },
                            agent: { type: "string" },
                            tool: { type: "string" },
                            params: { type: "object" },
                            on_failure: { type: "string", enum: ["retry", "compensate", "abort"] }
                        },
                        required: ["step_id", "agent", "tool", "params", "on_failure"]
                    }
                },
                validation_rules: { type: "object" }
            },
            required: ["workflow_id"]
        }, async (args) => {
            if (isProtectedPredefinedWorkflow(args.workflow_id)) {
                return { success: false, error: `Workflow '${args.workflow_id}' is system-protected and cannot be edited directly.` };
            }
            const workflows = workflowStore.list();
            const idx = workflows.findIndex(w => w.workflow_id === args.workflow_id);
            if (idx === -1) {
                return { success: false, error: `Workflow '${args.workflow_id}' not found.` };
            }

            if (args.name !== undefined) workflows[idx].name = args.name;
            if (args.description !== undefined) workflows[idx].description = args.description;
            if (args.trigger_event) workflows[idx].trigger_event = args.trigger_event;
            if (args.trigger_description !== undefined) workflows[idx].trigger_description = args.trigger_description;
            if (args.steps) workflows[idx].steps = args.steps;
            workflows[idx].updated_at = TimeAuthorityService.nowIST();

            workflowStore.saveAll(workflows);
            this._emitSystemEvent('workflow.updated', null, { workflow_id: args.workflow_id });
            return { success: true, message: `Workflow '${args.workflow_id}' updated successfully.` };
        });

        this.registerTool('list_pending_financial_workflow_requests', 'List all pending CEO authorization requests for financial workflows.', {
            type: 'object',
            properties: {}
        }, async () => {
            const pending = Array.from(this.financeAuthorizationRequests.values())
                .filter(r => r.status === 'PENDING_CEO_AUTHORIZATION');
            return { success: true, pending };
        });

        this.registerTool('approve_financial_workflow_request', 'CEO-only approval to execute a pending financial workflow request.', {
            type: 'object',
            properties: {
                authorization_id: { type: 'string' },
                approved_by: { type: 'string' },
                note: { type: 'string' }
            },
            required: ['authorization_id', 'approved_by']
        }, async (args) => {
            const request = this.financeAuthorizationRequests.get(args.authorization_id);
            if (!request) {
                return { success: false, status: 'NOT_FOUND', error: `Authorization request '${args.authorization_id}' not found.` };
            }
            if (request.status !== 'PENDING_CEO_AUTHORIZATION') {
                return { success: false, status: request.status, error: `Authorization request is already ${request.status}.` };
            }
            if (!this._isCeoApprover(args.approved_by)) {
                return { success: false, status: 'REJECTED', error: 'Only CEO can approve financial workflow requests.' };
            }

            request.status = 'APPROVED';
            request.decided_at = TimeAuthorityService.nowIST();
            request.decided_by = args.approved_by;
            request.note = args.note || null;
            this.financeAuthorizationRequests.set(request.authorization_id, request);

            const result = await this._executeDeterministicFinanceWorkflow(
                request.tool_name,
                {
                    ...request.args,
                    ceo_authorized: true,
                    approved_by: args.approved_by
                },
                'authorization'
            );

            request.execution_result = result;
            request.status = result?.status === 'SUCCESS' ? 'EXECUTED' : 'EXECUTION_FAILED';
            this.financeAuthorizationRequests.set(request.authorization_id, request);

            return {
                success: true,
                status: request.status,
                authorization_id: request.authorization_id,
                workflow_id: request.workflow_id,
                result
            };
        });

        this.registerTool('reject_financial_workflow_request', 'CEO-only rejection for a pending financial workflow request.', {
            type: 'object',
            properties: {
                authorization_id: { type: 'string' },
                rejected_by: { type: 'string' },
                reason: { type: 'string' }
            },
            required: ['authorization_id', 'rejected_by']
        }, async (args) => {
            const request = this.financeAuthorizationRequests.get(args.authorization_id);
            if (!request) {
                return { success: false, status: 'NOT_FOUND', error: `Authorization request '${args.authorization_id}' not found.` };
            }
            if (request.status !== 'PENDING_CEO_AUTHORIZATION') {
                return { success: false, status: request.status, error: `Authorization request is already ${request.status}.` };
            }
            if (!this._isCeoApprover(args.rejected_by)) {
                return { success: false, status: 'REJECTED', error: 'Only CEO can reject financial workflow requests.' };
            }

            request.status = 'REJECTED';
            request.decided_at = TimeAuthorityService.nowIST();
            request.decided_by = args.rejected_by;
            request.rejection_reason = args.reason || null;
            this.financeAuthorizationRequests.set(request.authorization_id, request);

            return { success: true, status: 'REJECTED', authorization_id: request.authorization_id };
        });
    }

    _emitSystemEvent(eventType, correlationId, payload = {}) {
        const event = {
            event_id: require('crypto').randomUUID(),
            event_type: eventType,
            event_version: "v1",
            timestamp: TimeAuthorityService.nowIST(),
            source: { type: "agent", name: this.name },
            correlation: { correlation_id: correlationId || "system" },
            payload: payload
        };
        this.emit('system_event', event);
    }

    // --- Session Logic ---

    async getOrCreateSession(identifier) {
        // Determine lookup strategy: phone number (string) or email (object { email })
        const isEmailLookup = typeof identifier === 'object' && identifier.email;
        let phone = null;
        let email = null;

        if (isEmailLookup) {
            email = identifier.email;
        } else {
            try {
                phone = PhoneNormalizationService.normalizeToE164(identifier);
            } catch (err) {
                console.error(`[MasterAI] Invalid phone number rejected: ${identifier}`);
                throw err;
            }
        }

        const sessionKey = phone || email;

        if (this.sessions.has(sessionKey)) {
            const session = this.sessions.get(sessionKey);
            // Reset Timeout on activity
            clearTimeout(session.timeoutId);
            session.timeoutId = setTimeout(() => this.flushSession(sessionKey), this.SESSION_TIMEOUT_MS);
            return session;
        }

        // Create New Session
        console.log(`[MasterAI] Starting new session for ${sessionKey}`);

        let leadContext = null;
        let leadId = null;
        let recentSessions = [];

        try {
            const crm = this.subAgents.find(a => a.name === 'CRMAgent');
            let lookup = { status: 'Not Found' };

            // Step 1: CRM Lookup — phone first, then email (§2.1 Fail Fast, Zero Retries)
            if (phone) {
                try {
                    lookup = await crm.callTool('get_lead_by_phone', { phone });
                } catch (err) {
                    console.error("[MasterAI] CRM Phone Lookup Failed:", err.message);
                }
            }

            if (lookup.status !== 'Found' && email) {
                try {
                    lookup = await crm.callTool('get_lead_by_email', { email });
                } catch (err) {
                    console.error("[MasterAI] CRM Email Lookup Failed:", err.message);
                }
            }

            if (lookup.status === 'Found') {
                leadContext = lookup.lead;
                leadId = lookup.lead.lead_id;
                console.log(`[MasterAI] Context Loaded: ${leadContext.name} (${leadId})`);

                // Step 2: Load last 3 conversations for known users (§2.1 Fail Fast)
                try {
                    const timeline = await crm.callTool('get_timeline', {
                        lead_id: leadId,
                        limit: 3,
                        type_filter: 'SESSION'
                    });
                    recentSessions = timeline.events || [];
                    if (recentSessions.length > 0) {
                        console.log(`[MasterAI] Loaded ${recentSessions.length} recent session(s) for ${leadId}`);
                    }
                } catch (err) {
                    console.error("[MasterAI] Timeline Load Failed:", err.message);
                    recentSessions = []; // Degrade: no history, but session still works
                }
            } else {
                // Step 3: Deferred lead creation — temporary in-memory lead
                console.log(`[MasterAI] New Unknown User. Creating temporary context...`);
                leadContext = {
                    lead_id: null,
                    name: null,
                    phone: phone,
                    email: email,
                    isTemporary: true,
                    profile_type: 'Customer'
                };
            }
        } catch (err) {
            console.error("[MasterAI] CRM Handshake Failed:", err.message);
            // Fallback: Proceed without CRM link (Failure Policy §2.1)
        }

        const session = {
            startTime: TimeAuthorityService.nowIST(),
            sessionKey: sessionKey,
            leadId: leadId,
            leadContext: leadContext,
            recentSessions: recentSessions,
            messages: [],
            timeoutId: setTimeout(() => this.flushSession(sessionKey), this.SESSION_TIMEOUT_MS)
        };

        this.sessions.set(sessionKey, session);
        return session;
    }

    async flushSession(sessionKey) {
        // sessionKey can be E.164 phone or email
        // Try to normalize if it looks like a phone, otherwise use as-is
        let key = sessionKey;
        if (typeof sessionKey === 'string' && !sessionKey.includes('@')) {
            try {
                key = PhoneNormalizationService.normalizeToE164(sessionKey);
            } catch (err) {
                // Not a phone — use as-is (email)
            }
        }

        const session = this.sessions.get(key);
        if (!session) return;

        this._emitSystemEvent('session.closed', session.leadId || key, { sessionKey: key, messageCount: session.messages.length });

        console.log(`[MasterAI] Session Timeout for ${key}. Processing flush...`);

        if (session.leadContext?.isTemporary) {
            // --- DEFERRED LEAD: AI-Judged Flush ---
            if (session.messages.length > 0) {
                try {
                    // Step 1: Ask LLM to classify the conversation
                    const classificationPrompt = `Analyze this conversation and respond with ONLY a JSON object:
{
  "is_business_relevant": true/false,
  "reason": "one line explanation",
  "extracted_name": "name if mentioned, else null",
  "summary": "2-3 line conversation summary",
  "sentiment": "Positive/Neutral/Negative",
  "tone": "Formal/Casual/Urgent"
}

Rules:
- Business-relevant = about our PG/hostel, rooms, rent, visits, complaints, payments, maintenance
- NOT relevant = wrong number, spam, random chat, greetings with no follow-up, unrelated questions`;

                    const classification = await this.openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: classificationPrompt },
                            ...session.messages.map(m => ({ role: m.role, content: m.content }))
                        ]
                    });

                    const verdict = JSON.parse(classification.choices[0].message.content);

                    // Step 2: If relevant → CRM snapshot process
                    if (verdict.is_business_relevant) {
                        try {
                            const crm = this.subAgents.find(a => a.name === 'CRMAgent');
                            const phone = session.leadContext.phone;

                            const newLead = await crm.callTool('add_lead', {
                                name: verdict.extracted_name || 'WhatsApp User',
                                primary_phone: phone,
                                source: { category: 'WhatsApp', detail: 'Auto-created after conversation' }
                            });

                            if (newLead.status === 'Lead Created' || newLead.status === 'Conflict') {
                                const leadId = newLead.lead_id || phone;
                                await crm.callTool('log_session', {
                                    lead_id: leadId,
                                    interaction_type: 'WhatsApp Conversation',
                                    participants: [phone, 'MasterAI'],
                                    summary: verdict.summary,
                                    sentiment: verdict.sentiment,
                                    tone: verdict.tone,
                                    financial_impact: 'None',
                                    compliance_impact: 'None',
                                    links: { artifacts: [] }
                                });
                                console.log(`[MasterAI] Deferred lead created and session logged for ${phone} (Reason: ${verdict.reason})`);
                            }
                        } catch (crmErr) {
                            // DATA PLANE: Don't lose classified data (Failure Policy §2.2)
                            console.error("[MasterAI] Flush CRM Write Failed:", crmErr.message);
                            this._emitSystemEvent('flush.failed', key, {
                                phone: session.leadContext.phone,
                                verdict: verdict,
                                messages: session.messages,
                                error: crmErr.message
                            });
                        }
                    } else {
                        console.log(`[MasterAI] Session dropped (not business-relevant): ${verdict.reason}`);
                    }
                } catch (llmErr) {
                    // LLM classification failed — can't determine relevance, drop session
                    console.error("[MasterAI] Flush Classification Failed:", llmErr.message);
                }
            } else {
                console.log(`[MasterAI] Empty temp session dropped.`);
            }
        } else if (session.leadId && session.messages.length > 0) {
            // --- KNOWN USER: Standard flush (existing behavior) ---
            try {
                const crm = this.subAgents.find(a => a.name === 'CRMAgent');
                await crm.callTool('log_session', {
                    lead_id: session.leadId,
                    interaction_type: 'WhatsApp Conversation',
                    participants: [key, 'MasterAI'],
                    summary: `Session with ${session.messages.length} messages.`,
                    sentiment: 'Neutral',
                    tone: 'Neutral',
                    financial_impact: 'None',
                    compliance_impact: 'None',
                    links: { artifacts: [] }
                });
                console.log(`[MasterAI] Session flushed successfully.`);
            } catch (err) {
                console.error(`[MasterAI] Failed to flush session:`, err.message);
            }
        } else {
            console.log(`[MasterAI] Empty or unlinked session. Dropped.`);
        }

        this.sessions.delete(key);
    }

    _extractRecentAttachedImageUrls(history = []) {
        if (!Array.isArray(history) || history.length === 0) return [];
        const markerRegex = /\[Attached\s+\d+\s+image\(s\)\s+—\s+use these as image_urls:\s*([^\]]+)\]/i;

        // Important for confirmation flows:
        // the final user turn may be "yes" while attachments were provided in an earlier turn.
        const userMessages = [...history].reverse().filter(m => m && m.role === 'user' && typeof m.content === 'string');
        for (const msg of userMessages) {
            const match = msg.content.match(markerRegex);
            if (!match || !match[1]) continue;

            const urls = match[1]
                .split(',')
                .map(s => s.trim())
                .filter(url => url.length > 0);
            if (urls.length > 0) return urls;
        }

        return [];
    }

    _injectImageUrlsIntoPropertyArgs(agent, toolName, args, history) {
        if (!agent || agent.name !== 'PropertyAI') return args;
        if (toolName !== 'add_property' && toolName !== 'update_property') return args;
        if (Array.isArray(args?.image_urls) && args.image_urls.length > 0) return args;

        const attachedUrls = this._extractRecentAttachedImageUrls(history);
        if (attachedUrls.length === 0) return args;

        return {
            ...args,
            image_urls: attachedUrls
        };
    }

    async chat(history, userContext = null) {
        try {
            // Check identity (Email via Dashboard, or profile_type via WhatsApp CRM Context)
            const ceoEmail = BusinessConfig.persona.ceo_email;
            const isCEO = userContext?.email === ceoEmail || userContext?.profile_type === 'CEO';
            const isStaff = !isCEO && (userContext?.profile_type === 'Staff'
                || (userContext?.email && userContext?.email !== ceoEmail));

            // Collect tools from all other agents
            const allTools = [];
            const agentMap = {};

            let agentIndex = 1;
            this.subAgents.forEach(agent => {
                const agentPrefix = isCEO ? agent.name : `SubAgent_${agentIndex}`;

                agent.getTools().forEach(tool => {
                    const namespacedName = `${agentPrefix}_${tool.name}`;

                    // Conditionally format the tool description based on identity
                    const toolDescription = isCEO
                        ? `[Agent: ${agent.name}] ${tool.description}`
                        : `[Internal System Tool] ${tool.description}`;

                    allTools.push({
                        type: "function",
                        function: {
                            name: namespacedName,
                            description: toolDescription,
                            parameters: tool.input_schema
                        }
                    });
                    agentMap[namespacedName] = { agent, toolName: tool.name };
                });
                agentIndex++;
            });

            // If CEO, also inject MasterAI's own native tools (like define_workflow)
            if (isCEO) {
                this.getTools().forEach(tool => {
                    const namespacedName = `MasterAI_${tool.name}`;
                    allTools.push({
                        type: "function",
                        function: {
                            name: namespacedName,
                            description: `[Master Orchestrator Native Tool] ${tool.description}`,
                            parameters: tool.input_schema
                        }
                    });
                    agentMap[namespacedName] = { agent: this, toolName: tool.name };
                });
            }

            const persona = BusinessConfig.persona;
            let systemPrompt = `You are ${persona.name} (${persona.role}). ${this.identity.description}. 
                
                **Communication Rules**:
                1. **Direct Reply**: You are chatting directly with the user. Just speak naturally.
                2. **Memory**: You have access to the conversation history. Use it.
                3. **CRM Policy**: 
                   - Do NOT log every "Hi" or "Hello" to the CRM.
                   - ONLY call CRM tools if you are performing a specific ACTION (e.g. "Create Lead", "Book Visit", "Update Status").
                   - If you just need to reply, just output text.
                4. **Tool Use**: If you use a tool, waiting for the result is automatic. You don't need to say "I'm checking".
                5. **Missing Info**: Do not guess IDs — look them up using the appropriate get/search tools.
                6. **Confirm Before Creating**: For any CREATE operation (new property, new staff, new lead, etc.), BEFORE executing:
                   a) Summarize what you received from the user.
                   b) Explicitly list the OPTIONAL fields that can still be filled, so the user can decide.
                   c) Ask: "Would you like to add any of these, or shall I proceed?"
                   d) Only execute after the user confirms or provides additional info.
                   This does NOT apply to follow-up operations within an already-confirmed plan (e.g., if the user confirmed creating a property with units, go ahead and add the units without asking again).
                7. **Dependency Awareness**: THINK before acting. If operation B depends on the result of operation A (e.g., creating a salary card requires a staff_id from hiring), do NOT call both in parallel. Execute A first, get its result, then execute B with the correct IDs. Only parallelize operations that are truly independent (e.g., recording 3 separate payments for 3 different tenants).
                8. **Planning**: For complex multi-step requests, mentally break them into ordered steps: Step 1 → get result → Step 2 → get result → Step 3. Execute each step, use the returned IDs for subsequent steps.
                9. **Image Attachments**: When the user attaches images to their message (visible as image_url content parts), and the current operation involves creating or updating an entity that accepts image fields (like \`image_urls\`), you MUST extract the data URLs from the attached images and pass them in the appropriate tool parameter. Do NOT ignore attached images.
                10. **Image Retrieval Requests**: If the user asks to view/show property images (or similar asset images), you MUST call the relevant retrieval tool first (for properties, use \`get_properties\`) and return the stored \`image_urls\` as clickable links. Do NOT say you cannot view images unless the tool confirms no images are available.`;

            // --- Dynamically inject agent operating instructions ---
            const agentInstructions = this.subAgents
                .map(a => a.getOperatingInstructions())
                .filter(instr => instr && instr.trim().length > 0)
                .join('\n\n');

            if (agentInstructions) {
                systemPrompt += `\n\n**Agent Operating Instructions (Auto-Generated)**:\n${agentInstructions}`;
            }

            if (isCEO) {
                systemPrompt += `\n\n**CEO OVERRIDE GRANTED**: You are currently speaking to the CEO & Business Owner on the internal Admin Dashboard. 
                You MAY openly discuss your internal system architecture, your underlying tools, and your sub-agent team.
                
                Your Internal Sub-Agent Team:
                ${this.subAgents.map(a => `- ${a.identity.role} (${a.name})`).join('\n')}`;
            } else if (isStaff) {
                systemPrompt += `\n\n**STAFF MODE**: You are speaking to an internal team member.
                - You MAY share operational details: occupancy rates, pending maintenance, tenant status, collection summaries, and task lists.
                - You MAY share schedules, pending approvals, and workflow statuses.
                - You must NOT reveal AI architecture, sub-agent names, tool prefixes, or system internals.
                - You must NOT share individual tenant financial details (specific amounts, payment history) unless the staff member's role requires it.
                - You must NOT reveal that you are an AI "Orchestrator" routing tasks to other AI models.
                - Act as ${persona.name}, the ${persona.role}. Treat this as a professional internal conversation.`;
            } else {
                systemPrompt += `\n\n**STRICT IDENTITY GUARDRAIL**: You are speaking to an external customer or prospective tenant.
                - Act as a unified, singular human representative named ${persona.name}.
                - You MAY share: available room types, pricing (public rate card), amenities, location details, visit scheduling, their own booking status, their own payment dues.
                - You must NOT share: other tenants' information, internal staff details, occupancy numbers, business revenue, operational costs, or any internal metrics.
                - You must NOT mention internal tools, AI agents, tool prefixes (e.g., PropertyAI_, CRMAgent_), or system architecture.
                - You must NOT reveal that you are an AI "Orchestrator" routing tasks to other AI models.
                - Keep responses warm, helpful, and sales-oriented.`;
            }

            // Inject recent conversation history for known users
            if (userContext?.recentSessions && userContext.recentSessions.length > 0) {
                systemPrompt += `\n\n**Recent Conversation History (last ${userContext.recentSessions.length}):**\n`;
                for (const s of userContext.recentSessions) {
                    systemPrompt += `- [${s.timestamp}] ${s.summary || 'No summary'} (Sentiment: ${s.sentiment || 'N/A'})\n`;
                }
            }

            // Add a specialized system prompt
            const messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...history
            ];

            this._emitSystemEvent('decision.requested', null, { historyLength: history.length });

            // Iterative Tool-Call Loop
            // The LLM may need multiple rounds of tool calls to complete a complex request
            // (e.g., create property → then add units → then link meter).
            // We loop until the LLM returns a response with NO tool_calls (i.e., a final text answer).
            const MAX_ITERATIONS = 10; // Safety cap to prevent infinite loops
            let iteration = 0;

            while (iteration < MAX_ITERATIONS) {
                iteration++;

                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: messages,
                    tools: allTools.length > 0 ? allTools : undefined,
                    tool_choice: allTools.length > 0 ? "auto" : undefined,
                });

                const assistantMessage = response.choices[0].message;

                this._emitSystemEvent('decision.generated', null, {
                    responseRole: assistantMessage.role,
                    hasToolCalls: !!assistantMessage.tool_calls,
                    iteration: iteration
                });

                // If no tool calls, this is the final text answer — return it
                if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
                    const timestampIST = TimeAuthorityService.nowIST();
                    const display = DateFormatterService.format(
                        timestampIST,
                        userContext?.timezone || 'Asia/Kolkata',
                        userContext?.date_format || 'DD-MM-YYYY'
                    );
                    return {
                        ...assistantMessage,
                        timestamp_ist: timestampIST,
                        ...display
                    };
                }

                // Tool calls present — execute them and loop back
                messages.push(assistantMessage);

                for (const toolCall of assistantMessage.tool_calls) {
                    const fnName = toolCall.function.name;
                    const parsedArgs = JSON.parse(toolCall.function.arguments);

                    if (agentMap[fnName]) {
                        const { agent, toolName } = agentMap[fnName];
                        const args = this._injectImageUrlsIntoPropertyArgs(agent, toolName, parsedArgs, history);
                        console.log(`[MasterAI] Iteration ${iteration}: Calling ${toolName} on ${agent.name}`);

                        let result;
                        try {
                            this._emitSystemEvent('tool.execution_start', null, { tool: toolName, agent: agent.name });
                            if (this._isFinanceMutationTool(agent.name, toolName)) {
                                result = await this._executeDeterministicFinanceWorkflow(toolName, args, 'chat');
                            } else {
                                result = await agent.callTool(toolName, args);
                            }
                            this._emitSystemEvent('tool.execution_end', null, { tool: toolName, agent: agent.name, result });
                        } catch (err) {
                            console.error(`[MasterAI] Tool Error (${toolName}):`, err.message);
                            this._emitSystemEvent('tool.error', null, { tool: toolName, error: err.message });
                            result = { error: err.message, status: "Failed" };
                        }

                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result)
                        });
                    } else {
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: "Tool not found" })
                        });
                    }
                }
                // Loop back — the next iteration will call the LLM again WITH tools
            }

            // If we hit the safety cap, return whatever we have
            console.warn(`[MasterAI] Hit max iteration cap (${MAX_ITERATIONS}). Forcing final response.`);
            const finalForced = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages
            });
            const forcedMessage = finalForced.choices[0].message;
            const timestampIST = TimeAuthorityService.nowIST();
            const display = DateFormatterService.format(
                timestampIST,
                userContext?.timezone || 'Asia/Kolkata',
                userContext?.date_format || 'DD-MM-YYYY'
            );
            return {
                ...forcedMessage,
                timestamp_ist: timestampIST,
                ...display
            };

        } catch (error) {
            console.error("MasterAI Chat Error:", error);
            this._emitSystemEvent('error', null, { error: error.message });
            return { role: "assistant", content: "I encountered an error connecting to my brain. Please check the logs." };
        }
    }

    async process_event(event) {
        // Generic Message Handler for ANY source (WhatsApp, Email, Portal, etc.)
        if (event.event_type === 'message.received') {
            const from = event.payload?.from;
            let text = event.payload?.body;
            const source = event.context?.channel || 'Unknown';
            const msgType = event.payload?.raw?.type;

            if (!text && event.payload.media) {
                text = `[User sent a ${msgType || 'media'} file]`;
            }

            if (!text) {
                console.log(`[MasterAI] Ignoring empty/unsupported message from ${from}`);
                return;
            }

            console.log(`[MasterAI] Processing ${source} from ${from}: ${text}`);

            // 1. Get/Create Session (Manages Context & Timeout)
            const session = await this.getOrCreateSession(from);

            this._emitSystemEvent('workflow.started', session.leadId || from, { source, from });

            // 2. Buffer User Message
            session.messages.push({ role: 'user', content: text, timestamp: TimeAuthorityService.nowIST() });

            // 3. Prepare Context for Brain (System + Memory)
            // Flatten session messages for LLM
            const history = session.messages.map(m => ({ role: m.role, content: m.content }));

            // 4. Autonomous Decision (Chat) - Pass the CRM Context as User Identity
            const response = await this.chat(history, session.leadContext);

            // 5. Handle Response
            if (response && response.content) {
                // Buffer Assistant Message
                session.messages.push({ role: 'assistant', content: response.content, timestamp: TimeAuthorityService.nowIST() });

                console.log(`[MasterAI] Brain spoke: "${response.content}". Sending reply via ${source}.`);

                // 6. Send Reply
                const commsAgent = this.subAgents.find(a => a.name === 'CommunicationsAI');
                const normFrom = PhoneNormalizationService.normalizeToE164(from);

                if (commsAgent && source === 'whatsapp') {
                    await commsAgent.callTool('send_text_message', {
                        recipient_phone: normFrom,
                        content: response.content
                    });
                } else if (commsAgent) {
                    // Fallback for other channels if supported later, or assume generic send_message
                    await commsAgent.callTool('send_text_message', {
                        recipient_phone: normFrom,
                        content: response.content
                    });
                }
            }

            this._emitSystemEvent('workflow.ended', session.leadId || from, { source, from });
        }
    }

    async executeSubagentTool(agentName, toolName, args) {
        // Find the agent
        const agent = this.subAgents.find(a => a.name === agentName);
        if (!agent) {
            throw new Error(`SubAgent '${agentName}' not found or not connected to MasterAI.`);
        }

        try {
            this._emitSystemEvent('tool.execution_start', null, { tool: toolName, agent: agent.name, source: 'dashboard' });

            // Execute the tool
            const result = this._isFinanceMutationTool(agent.name, toolName)
                ? await this._executeDeterministicFinanceWorkflow(toolName, args, 'dashboard')
                : await agent.callTool(toolName, args);

            this._emitSystemEvent('tool.execution_end', null, { tool: toolName, agent: agent.name, result, source: 'dashboard' });
            return result;
        } catch (err) {
            if (String(err.message || '').includes(`Tool ${toolName} not found`)) {
                throw new Error(`Tool '${toolName}' not found on Agent '${agentName}'.`);
            }
            console.error(`[MasterAI] Exec Tool Error (${agentName}.${toolName}):`, err.message);
            this._emitSystemEvent('tool.error', null, { tool: toolName, agent: agent.name, error: err.message, source: 'dashboard' });
            throw err;
        }
    }
}

module.exports = MasterAI;
