class BaseAgent {
  constructor(config = {}) {
    this.name = config.name || 'UnknownAgent';
    // Rich metadata schema
    this.identity = config.identity || {}; // { systemName, personaName, role, description }
    this.capabilities = config.capabilities || {}; // { skills, tools }
    this.directives = config.directives || {}; // { goals, constraints }
    this.hierarchy = config.hierarchy || {}; // { supervisor, subAgents }

    this.tools = {};

    // Sub-agents are now passed via config or hierarchy
    this.subAgents = Array.isArray(this.hierarchy.subAgents) ? this.hierarchy.subAgents : [];
  }

  registerTool(name, description, schema, handler) {
    this.tools[name] = { description, schema, handler };
  }

  getTools() {
    return Object.keys(this.tools).map(key => ({
      name: key,
      description: this.tools[key].description,
      input_schema: this.tools[key].schema
    }));
  }

  async callTool(name, args) {
    if (this.tools[name]) {
      try {
        console.log(`[${this.name}] Executing tool: ${name} with args:`, args);
        const result = await this.tools[name].handler(args);
        return result;
      } catch (error) {
        console.error(`[${this.name}] Error executing tool ${name}:`, error);
        throw error;
      }
    }
    throw new Error(`Tool ${name} not found in agent ${this.name}`);
  }

  getStatus() {
    return {
      name: this.name,
      identity: this.identity,
      capabilities: {
        ...this.capabilities,
        registeredTools: Object.keys(this.tools)
      },
      directives: this.directives,
      status: 'active',
      subAgents: this.subAgents.map(sa => sa.getStatus())
    };
  }
}

module.exports = BaseAgent;
