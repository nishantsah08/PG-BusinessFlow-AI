const EventEmitter = require('events');
const TimeAuthorityService = require('../services/TimeAuthorityService');

class BaseAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || 'UnknownAgent';
    // Rich metadata schema
    this.identity = config.identity || {}; // { systemName, personaName, role, description }
    this.capabilities = config.capabilities || {}; // { skills, tools }
    this.directives = config.directives || {}; // { goals, constraints }
    this.hierarchy = config.hierarchy || {}; // { supervisor, subAgents }

    this.tools = {};
    this.status = 'online';

    // Sub-agents are now passed via config or hierarchy
    this.subAgents = Array.isArray(this.hierarchy.subAgents) ? this.hierarchy.subAgents : [];
  }

  enable() {
    this.status = 'online';
    this.emit('status_change', { agent: this.name, status: this.status });
  }

  disable() {
    this.status = 'offline';
    this.emit('status_change', { agent: this.name, status: this.status });
  }

  restart() {
    this.disable();
    setTimeout(() => {
      this.enable();
    }, 1000);
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
    const tool = this.tools[name];
    if (tool) {
      // Basic Schema Validation (Required Fields)
      if (tool.schema && tool.schema.required) {
        for (const req of tool.schema.required) {
          if (args[req] === undefined || args[req] === null) {
            throw new Error(`Invalid input for ${name}: missing required property "${req}"`);
          }
        }
      }

      try {
        console.log(`[${this.name}] Executing tool: ${name} with args:`, args);
        // Default: Emit tool execution start event
        this.emit('tool_start', { agent: this.name, tool: name, args });

        // Enforce 60s Timeout (System Policy)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool execution timed out after 60000ms`)), 60000)
        );

        const result = await Promise.race([
          tool.handler(args),
          timeoutPromise
        ]);

        // Default: Emit tool execution success event
        this.emit('tool_end', { agent: this.name, tool: name, result });

        return result;
      } catch (error) {
        console.error(`[${this.name}] Error executing tool ${name}:`, error);
        this.emit('tool_error', { agent: this.name, tool: name, error });
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
      status: this.status,
      last_heartbeat: TimeAuthorityService.nowIST(),
      latency_ms: Math.floor(Math.random() * 50) + 10, // Simulated 10-60ms latency
      subAgents: this.subAgents.map(sa => sa.getStatus())
    };
  }
}

module.exports = BaseAgent;
