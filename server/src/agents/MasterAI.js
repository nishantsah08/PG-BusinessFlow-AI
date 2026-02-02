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
    }

    async chat(history) {
        try {
            // Collect tools from all other agents
            const allTools = [];
            const agentMap = {};

            this.subAgents.forEach(agent => {
                agent.getTools().forEach(tool => {
                    const namespacedName = `${agent.name}_${tool.name}`;
                    allTools.push({
                        type: "function",
                        function: {
                            name: namespacedName,
                            description: `[Agent: ${agent.name}] ${tool.description}`,
                            parameters: tool.input_schema
                        }
                    });
                    agentMap[namespacedName] = { agent, toolName: tool.name };
                });
            });

            // Add a specialized system prompt
            const messages = [
                {
                    role: "system",
                    content: `You are ${this.identity.personaName} (${this.identity.role}). ${this.identity.description}. 
                
                Your Team:
                ${this.subAgents.map(a => `- ${a.identity.role} (${a.name})`).join('\n')}
                
                Always use the available tools to delegate tasks. If you need to speak to the user, just reply.`
                },
                ...history
            ];

            // 1. First call to LLM
            const runner = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                tools: allTools.length > 0 ? allTools : undefined,
                tool_choice: allTools.length > 0 ? "auto" : undefined,
            });

            const message = runner.choices[0].message;

            // 2. Handle Tool Calls
            if (message.tool_calls) {
                messages.push(message);

                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);

                    if (agentMap[fnName]) {
                        const { agent, toolName } = agentMap[fnName];
                        console.log(`MasterAI delegation: Calling ${toolName} on ${agent.name}`);

                        const result = await agent.callTool(toolName, args);

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
            return { role: "assistant", content: "I encountered an error connecting to my brain. Please check the logs." };
        }
    }
}

module.exports = MasterAI;
