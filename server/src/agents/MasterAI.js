const BaseAgent = require('./BaseAgent');
const OpenAI = require('openai');
const PhoneNormalizationService = require('../services/PhoneNormalizationService');

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
            startTime: new Date().toISOString(),
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

    async chat(history, userContext = null) {
        try {
            // Check identity (Email via Dashboard, or profile_type via WhatsApp CRM Context)
            const isCEO = userContext?.email === 'nishantsah@outlook.in' || userContext?.profile_type === 'CEO';
            const isStaff = !isCEO && (userContext?.profile_type === 'Staff'
                || (userContext?.email && userContext?.email !== 'nishantsah@outlook.in'));

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
            } else if (isStaff) {
                systemPrompt += `\n\n**STAFF MODE**: You are speaking to an internal team member.
                - You MAY share operational details: occupancy rates, pending maintenance, tenant status, collection summaries, and task lists.
                - You MAY share schedules, pending approvals, and workflow statuses.
                - You must NOT reveal AI architecture, sub-agent names, tool prefixes, or system internals.
                - You must NOT share individual tenant financial details (specific amounts, payment history) unless the staff member's role requires it.
                - You must NOT reveal that you are an AI "Orchestrator" routing tasks to other AI models.
                - Act as Kalyani, the Head of Operations. Treat this as a professional internal conversation.`;
            } else {
                systemPrompt += `\n\n**STRICT IDENTITY GUARDRAIL**: You are speaking to an external customer or prospective tenant.
                - Act as a unified, singular human representative named Kalyani.
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
}

module.exports = MasterAI;
