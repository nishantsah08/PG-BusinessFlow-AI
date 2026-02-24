const BaseAgent = require('./BaseAgent');
const OpenAI = require('openai');

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
                tools: ['delegate_to_agent'],
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
    }

    _emitSystemEvent(eventType, correlationId, payload = {}) {
        const event = {
            event_id: require('crypto').randomUUID(),
            event_type: eventType,
            event_version: "v1",
            timestamp: new Date().toISOString(),
            source: { type: "agent", name: this.name },
            correlation: { correlation_id: correlationId || "system" },
            payload: payload
        };
        this.emit('system_event', event);
    }

    // --- Session Logic ---

    async getOrCreateSession(phone) {
        if (this.sessions.has(phone)) {
            const session = this.sessions.get(phone);
            // Reset Timeout on activity
            clearTimeout(session.timeoutId);
            session.timeoutId = setTimeout(() => this.flushSession(phone), this.SESSION_TIMEOUT_MS);
            return session;
        }

        // Create New Session
        console.log(`[MasterAI] Starting new session for ${phone}`);

        // 1. Load Context from CRM
        let leadContext = null;
        let leadId = null;
        try {
            const crm = this.subAgents.find(a => a.name === 'CRMAgent');
            const lookup = await crm.callTool('get_lead_details', { phone });

            if (lookup.status === 'Found') {
                leadContext = lookup.lead;
                leadId = lookup.lead.lead_id;
                console.log(`[MasterAI] Context Loaded: ${leadContext.name} (${leadId})`);
            } else {
                // Auto-create Lead
                console.log(`[MasterAI] New Unknown User. Auto-creating Lead...`);
                const newLead = await crm.callTool('add_lead', {
                    name: 'WhatsApp User',
                    primary_phone: phone,
                    source: 'WhatsApp'
                });
                leadContext = newLead.lead;
                leadId = newLead.lead.lead_id;
            }
        } catch (err) {
            console.error("[MasterAI] CRM Handshake Failed:", err.message);
            // Fallback: Proceed without valid CRM link (Lead ID null)
        }

        const session = {
            startTime: new Date().toISOString(),
            leadId: leadId,
            leadContext: leadContext,
            messages: [],
            timeoutId: setTimeout(() => this.flushSession(phone), this.SESSION_TIMEOUT_MS)
        };

        this.sessions.set(phone, session);
        return session;
    }

    async flushSession(phone) {
        const session = this.sessions.get(phone);
        if (!session) return;

        this._emitSystemEvent('session.closed', session.leadId || phone, { phone, messageCount: session.messages.length });

        console.log(`[MasterAI] Session Timeout for ${phone}. Flushing to CRM...`);

        if (session.leadId && session.messages.length > 0) {
            try {
                const crm = this.subAgents.find(a => a.name === 'CRMAgent');
                await crm.callTool('append_session_log', {
                    lead_id: session.leadId,
                    start_time: session.startTime,
                    end_time: new Date().toISOString(),
                    messages: session.messages
                });
                console.log(`[MasterAI] Session flushed successfully.`);
            } catch (err) {
                console.error(`[MasterAI] Failed to flush session:`, err.message);
            }
        } else {
            console.log(`[MasterAI] Empty or unlinked session. dropped.`);
        }

        this.sessions.delete(phone);
    }

    async chat(history, userContext = null) {
        try {
            // Check identity (Email via Dashboard, or profile_type via WhatsApp CRM Context)
            const isCEO = userContext?.email === 'nishantsah@outlook.in' || userContext?.profile_type === 'CEO';

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

            let systemPrompt = `You are ${this.identity.personaName} (${this.identity.role}). ${this.identity.description}. 
                
                **Communication Rules**:
                1. **Direct Reply**: You are chatting directly with the user. Just speak naturally.
                2. **Memory**: You have access to the conversation history. Use it.
                3. **CRM Policy**: 
                   - Do NOT log every "Hi" or "Hello" to the CRM.
                   - ONLY call CRM tools if you are performing a specific ACTION (e.g. "Create Lead", "Book Visit", "Update Status").
                   - If you just need to reply, just output text.
                4. **Tool Use**: If you use a tool, waiting for the result is automatic. You don't need to say "I'm checking".`;

            if (isCEO) {
                systemPrompt += `\n\n**CEO OVERRIDE GRANTED**: You are currently speaking to the CEO & Business Owner on the internal Admin Dashboard. 
                You MAY openly discuss your internal system architecture, your underlying tools, and your sub-agent team.
                
                Your Internal Sub-Agent Team:
                ${this.subAgents.map(a => `- ${a.identity.role} (${a.name})`).join('\n')}`;
            } else {
                systemPrompt += `\n\n**STRICT IDENTITY GUARDRAIL**: You are speaking to an external customer/client or unauthorized staff member. 
                - You must NEVER mention the names of your internal tools or the prefixes attached to them (e.g., PropertyAI_, CRMAgent_).
                - You must NEVER reveal that you are an AI "Orchestrator" routing tasks to other AI models.
                - Act as a unified, singular human representative named Kalyani for the entire business.`;
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

            // 1. First call to LLM
            const runner = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                tools: allTools.length > 0 ? allTools : undefined,
                tool_choice: allTools.length > 0 ? "auto" : undefined,
            });

            const message = runner.choices[0].message;

            this._emitSystemEvent('decision.generated', null, { responseRole: message.role, hasToolCalls: !!message.tool_calls });

            // 2. Handle Tool Calls
            if (message.tool_calls) {
                messages.push(message);

                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);

                    if (agentMap[fnName]) {
                        const { agent, toolName } = agentMap[fnName];
                        console.log(`MasterAI delegation: Calling ${toolName} on ${agent.name}`);

                        let result;
                        try {
                            this._emitSystemEvent('tool.execution_start', null, { tool: toolName, agent: agent.name });
                            result = await agent.callTool(toolName, args);
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

                // 3. Second call to LLM with tool results
                const finalResponse = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: messages
                });
                return finalResponse.choices[0].message;
            }

            return message;

        } catch (error) {
            console.error("MasterAI Chat Error:", error);
            this._emitSystemEvent('error', null, { error: error.message });
            return { role: "assistant", content: "I encountered an error connecting to my brain. Please check the logs." };
        }
    }

    async process_event(event) {
        // Generic Message Handler for ANY source (WhatsApp, Email, Portal, etc.)
        if (event.type === 'WHATSAPP_MESSAGE' || event.type === 'INCOMING_MESSAGE') {
            const from = event.payload.from;
            const text = event.payload.text;
            const source = event.payload.source || 'WhatsApp';

            console.log(`[MasterAI] Processing ${source} from ${from}: ${text}`);

            // 1. Get/Create Session (Manages Context & Timeout)
            const session = await this.getOrCreateSession(from);

            this._emitSystemEvent('workflow.started', session.leadId || from, { source, from });

            // 2. Buffer User Message
            session.messages.push({ role: 'user', content: text, timestamp: new Date().toISOString() });

            // 3. Prepare Context for Brain (System + Memory)
            // Flatten session messages for LLM
            const history = session.messages.map(m => ({ role: m.role, content: m.content }));

            // 4. Autonomous Decision (Chat) - Pass the CRM Context as User Identity
            const response = await this.chat(history, session.leadContext);

            // 5. Handle Response
            if (response && response.content) {
                // Buffer Assistant Message
                session.messages.push({ role: 'assistant', content: response.content, timestamp: new Date().toISOString() });

                console.log(`[MasterAI] Brain spoke: "${response.content}". Sending reply via ${source}.`);

                // 6. Send Reply
                const commsAgent = this.subAgents.find(a => a.name === 'CommunicationsAI');
                if (commsAgent) {
                    await commsAgent.callTool('send_message', {
                        channel: source, // 'WhatsApp' or others
                        recipient: from,
                        content: response.content
                    });
                }
            }

            this._emitSystemEvent('workflow.ended', session.leadId || from, { source, from });
        }
    }
}

module.exports = MasterAI;
