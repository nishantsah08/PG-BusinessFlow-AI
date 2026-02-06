const BaseAgent = require('./BaseAgent');

class CRMAgent extends BaseAgent {
    constructor() {
        super({
            name: 'CRMAgent',
            identity: {
                role: 'Lead & Tenant Relationship Manager',
                description: 'Manages leads, interactions, and merge logic.'
            },
            capabilities: {
                skills: ['Lead Tracking', 'Identity Resolution'],
                tools: ['add_lead', 'log_interaction', 'move_lead_bucket', 'get_leads_by_bucket']
            },
            directives: {
                goals: ['Single customer view', 'Merge duplicates'],
                constraints: ['Privacy respected']
            }
        });

        this.leads = []; // { lead_id, name, phones: [], status: 'Enquiry'|'Visited'|'Onboarded', history: [] }

        this.registerTools();
    }

    registerTools() {
        // add_lead
        this.registerTool('add_lead', 'Add a new lead', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                primary_phone: { type: 'string' },
                source: { type: 'string' }
            },
            required: ['name', 'primary_phone']
        }, async (args) => {
            // Simple check existing
            const existing = this.leads.find(l => l.phones.primary === args.primary_phone || (l.phones.others && l.phones.others.includes(args.primary_phone)));

            if (existing) {
                return { status: "Lead Updated", lead_id: existing.lead_id, note: "Existing phone merged" };
            }

            const lead = {
                lead_id: `LEAD-${this.leads.length + 1}`,
                name: args.name,
                phones: { primary: args.primary_phone, others: [] },
                source: args.source || 'Unknown',
                status: 'Enquiry',
                history: []
            };
            this.leads.push(lead);
            this.leads.push(lead);
            return { status: "Lead Created", lead: lead };
        });

        // get_lead_details
        this.registerTool('get_lead_details', 'Get full lead profile', {
            type: 'object',
            properties: {
                phone: { type: 'string' }
            },
            required: ['phone']
        }, async (args) => {
            const lead = this.leads.find(l => l.phones.primary === args.phone || (l.phones.others && l.phones.others.includes(args.phone)));
            if (!lead) return { status: "Not Found" };
            return { status: "Found", lead: lead };
        });

        // append_session_log
        this.registerTool('append_session_log', 'Archive a full chat session', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string' },
                            content: { type: 'string' },
                            timestamp: { type: 'string' }
                        }
                    }
                }
            },
            required: ['lead_id', 'start_time', 'messages']
        }, async (args) => {
            const lead = this.leads.find(l => l.lead_id === args.lead_id);
            if (!lead) throw new Error("Lead not found");

            const sessionEntry = {
                id: `SESS-${lead.history.length + 1}`,
                type: 'SESSION',
                ...args
            };
            lead.history.push(sessionEntry);

            // Remove the active link if necessary (optional implementation detail)
            // lead.active_chat_ref = null; 

            return { status: "Session Archived", session_id: sessionEntry.id };
        });

        // log_interaction
        this.registerTool('log_interaction', 'Log a call, visit, or msg', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                interaction_type: { type: 'string' }, // Call/Visit/Msg
                summary: { type: 'string' },
                sentiment: { type: 'string' }
            },
            required: ['lead_id', 'interaction_type']
        }, async (args) => {
            const lead = this.leads.find(l => l.lead_id === args.lead_id);
            if (!lead) throw new Error("Lead not found");

            const interaction = {
                id: `INT-${lead.history.length + 1}`,
                ...args,
                date: new Date().toISOString()
            };
            lead.history.push(interaction);

            // Implicit Merge Logic Demo
            if (args.interaction_type === 'Visit' && lead.status === 'Enquiry') {
                // Logic: Logic to upgrade status or checking for dupes would go here
                // For now just logging
            }

            return { status: "Interaction Logged", snapshot_updated: true };
        });

        // move_lead_bucket
        this.registerTool('move_lead_bucket', 'Change lead status', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                target_bucket: { type: 'string' } // Enquiry/Visited/Onboarded
            },
            required: ['lead_id', 'target_bucket']
        }, async (args) => {
            const lead = this.leads.find(l => l.lead_id === args.lead_id);
            if (!lead) throw new Error("Lead not found");

            lead.status = args.target_bucket;
            return { status: "Bucket Moved", new_status: lead.status };
        });

        // get_leads_by_bucket
        this.registerTool('get_leads_by_bucket', 'Filter leads', {
            type: 'object',
            properties: {
                bucket: { type: 'string' }
            },
            required: ['bucket']
        }, async (args) => {
            return this.leads.filter(l => l.status === args.bucket);
        });
    }
}

module.exports = CRMAgent;
