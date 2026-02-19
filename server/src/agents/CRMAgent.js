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
                skills: ['Lead Tracking', 'Identity Resolution', 'Profile Management'],
                tools: [
                    'add_lead', 'change_status', 'merge_leads', 'archive_lead',
                    'update_lead_snapshot', 'add_secondary_phone', 'set_primary_phone',
                    'log_session', 'add_manual_note', 'get_timeline',
                    'get_lead_by_phone', 'search_leads', 'get_leads_by_status', 'get_recent_leads', 'get_dashboard_stats',
                    'link_artifact', 'get_lead_artifacts'
                ]
            },
            directives: {
                goals: ['Single customer view', 'Merge duplicates'],
                constraints: ['Privacy respected', 'Append-only timeline']
            }
        });

        // Data Store (In-Memory for Phase 1)
        this.leads = new Map(); // Key: lead_id (primary phone), Value: Lead Snapshot
        this.timelines = new Map(); // Key: lead_id, Value: Array of Events

        this.registerTools();
    }

    registerTools() {
        // =========================================================================
        // Core Lifecycle
        // =========================================================================

        this.registerTool('add_lead', 'Create a new lead with full profile', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                primary_phone: { type: 'string' },
                profile_type: { type: 'string', enum: ['Customer', 'Staff', 'CEO'] },
                email: { type: 'string' },
                source: { type: 'object' },
                demographics: { type: 'object' },
                preferences: { type: 'array', items: { type: 'string' } },
                unit_type_required: { type: 'string' },
                requirement_date: { type: 'string' },
                notes: { type: 'object' } // mapped to ai_notes
            },
            required: ['name', 'primary_phone']
        }, async (args) => {
            const leadId = args.primary_phone;

            // Check for existing lead (Primary or Secondary)
            const existing = await this._findLeadByPhone(leadId);
            if (existing) {
                // If it exists but we are explicitly setting profile_type (e.g. converting to Staff), allow update?
                // For now, strict conflict as per original logic, but HRAgent might hit this if staff was already a lead.
                // If it's HRAgent calling, we might want to Update instead of Conflict.
                // But this tool is 'add_lead'. 'update_lead_snapshot' should be used for updates.
                // HR Agent logic should handle "If exists, update profile_type".
                return {
                    status: "Conflict",
                    message: "Lead already exists with this phone number",
                    lead_id: existing.lead_id
                };
            }

            const now = new Date().toISOString();
            const lead = {
                lead_id: leadId,
                name: args.name,
                profile_type: args.profile_type || 'Customer',
                email: args.email || null,
                phones: {
                    primary: { number: leadId, whatsapp: true },
                    others: []
                },
                source: args.source || { category: 'Direct', detail: null },
                demographics: args.demographics || {},
                preferences: args.preferences || [],
                unit_type_required: args.unit_type_required || null,
                requirement_date: args.requirement_date || null,
                ai_notes: args.notes || {},
                status: 'Enquiry',
                created_at: now
            };

            this.leads.set(leadId, lead);
            this.timelines.set(leadId, []);

            this._logEvent(leadId, 'STATUS_CHANGE', {
                from: null,
                to: 'Enquiry',
                reason: 'Lead Created',
                changed_at: now
            });

            return { status: "Lead Created", lead_id: leadId };
        });

        this.registerTool('change_status', 'Update lead status lifecycle', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                to_status: { type: 'string' },
                reason: { type: 'string' }
            },
            required: ['lead_id', 'to_status', 'reason']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            const fromStatus = lead.status;
            const toStatus = args.to_status;

            // Strict Lifecycle State Machine
            const allowedTransitions = {
                'Enquiry': ['Visited'],
                'Visited': ['Onboarded'],
                'Onboarded': ['Left'],
                'Left': ['Enquiry']
            };

            // Allow transitions from Archived back to Enquiry (Reactivation) if logical, 
            // but strict prompt says "All other... fail". 
            // I'll stick to the core 4. If lead is Archived, it might need 'add_lead' again or special handling.
            // For now, strict adherence.

            if (!allowedTransitions[fromStatus] || !allowedTransitions[fromStatus].includes(toStatus)) {
                return {
                    status: "Invalid Transition",
                    message: `Lifecycle violation: Cannot move from ${fromStatus} to ${toStatus}`
                };
            }

            lead.status = toStatus;

            this._logEvent(args.lead_id, 'STATUS_CHANGE', {
                from: fromStatus,
                to: toStatus,
                reason: args.reason,
                changed_at: new Date().toISOString()
            });

            return { status: "Status Updated", previous: fromStatus, current: toStatus };
        });

        this.registerTool('archive_lead', 'Soft delete a lead', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                reason: { type: 'string' }
            },
            required: ['lead_id']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            lead.status = 'Archived';
            this._logEvent(args.lead_id, 'STATUS_CHANGE', {
                from: lead.status,
                to: 'Archived',
                reason: args.reason || 'Manual Archive',
                changed_at: new Date().toISOString()
            });
            return { status: "Lead Archived", lead_id: args.lead_id };
        });

        this.registerTool('merge_leads', 'Merge source lead into target lead', {
            type: 'object',
            properties: {
                source_lead_id: { type: 'string' },
                target_lead_id: { type: 'string' },
                relationship: { type: 'string' }
            },
            required: ['source_lead_id', 'target_lead_id']
        }, async (args) => {
            const source = this.leads.get(args.source_lead_id);
            const target = this.leads.get(args.target_lead_id);

            if (!source || !target) return { status: "Error", message: "One or both leads not found" };

            // 1. Move phone to target
            target.phones.others.push({ number: source.phones.primary.number, whatsapp: source.phones.primary.whatsapp });
            target.phones.others.push(...source.phones.others);

            // 2. Copy Timeline
            const sourceTimeline = this.timelines.get(args.source_lead_id) || [];
            const targetTimeline = this.timelines.get(args.target_lead_id);
            targetTimeline.push(...sourceTimeline);

            // Re-sort timeline by timestamp
            targetTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // 3. Log Merge Event
            this._logEvent(args.target_lead_id, 'MERGE', {
                absorbed_lead_id: args.source_lead_id,
                relationship: args.relationship,
                reason: 'Identity Resolution'
            });

            // 4. Delete Source
            this.leads.delete(args.source_lead_id);
            this.timelines.delete(args.source_lead_id);

            return { status: "Merge Complete", surviving_lead_id: args.target_lead_id };
        });

        // =========================================================================
        // Profile Management
        // =========================================================================

        this.registerTool('update_lead_snapshot', 'Enrich lead profile fields', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                demographics: { type: 'object' },
                preferences: { type: 'array', items: { type: 'string' } },
                email: { type: 'string' },
                source: { type: 'object' },
                ai_notes: { type: 'object' },
                profile_type: { type: 'string', enum: ['Customer', 'Staff', 'CEO'] }
            },
            required: ['lead_id']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            if (args.demographics) lead.demographics = { ...lead.demographics, ...args.demographics };
            if (args.preferences) lead.preferences = args.preferences;
            if (args.email) lead.email = args.email;
            if (args.source) lead.source = args.source;
            if (args.ai_notes) lead.ai_notes = { ...lead.ai_notes, ...args.ai_notes };
            if (args.profile_type) lead.profile_type = args.profile_type;

            return { status: "Snapshot Updated", lead_id: args.lead_id };
        });

        this.registerTool('add_secondary_phone', 'Add alternate phone', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                phone_number: { type: 'string' },
                label: { type: 'string' }
            },
            required: ['lead_id', 'phone_number']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            if (lead.phones.others.find(p => p.number === args.phone_number)) {
                return { status: "Exists", message: "Number already in secondary list" };
            }
            lead.phones.others.push({ number: args.phone_number, label: args.label, whatsapp: false });
            return { status: "Phone Added", lead_id: args.lead_id };
        });

        this.registerTool('set_primary_phone', 'Swap primary phone', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                phone_number: { type: 'string' }
            },
            required: ['lead_id', 'phone_number']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            // Logic to swap would go here. Complex because lead_id IS the phone.
            // For Phase 1, we might restrict this or implement full ID migration.
            // Implementing simplified version: Update phone, BUT keep lead_id same for now 
            // OR fully migrate data.
            // DECISION: Reject for now as it changes ID (Key).
            return { status: "Not Implemented", message: "Changing primary phone requires ID migration. Feature pending." };
        });

        // =========================================================================
        // Timeline & Interaction
        // =========================================================================

        this.registerTool('log_session', 'Log a full chatbot session', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                interaction_type: { type: 'string' },
                participants: { type: 'array', items: { type: 'string' } },
                summary: { type: 'string' },
                sentiment: { type: 'string' },
                tone: { type: 'string' },
                financial_impact: { type: 'string' },
                compliance_impact: { type: 'string' },
                links: { type: 'object' } // { artifacts: [], workflow_id: ... }
            },
            required: ['lead_id', 'summary']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            const event = this._logEvent(args.lead_id, 'SESSION', args);
            return { status: "Session Logged", event_id: event.event_id };
        });

        this.registerTool('add_manual_note', 'Add a human note', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                content: { type: 'string' },
                author: { type: 'string' }
            },
            required: ['lead_id', 'content']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            const event = this._logEvent(args.lead_id, 'NOTE', {
                content: args.content,
                author: args.author || 'system'
            });
            return { status: "Note Added", event_id: event.event_id };
        });

        this.registerTool('get_timeline', 'Get chronological events', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                limit: { type: 'integer' },
                type_filter: { type: 'string' }
            },
            required: ['lead_id']
        }, async (args) => {
            const timeline = this.timelines.get(args.lead_id);
            if (!timeline) return { status: "Error", message: "Lead not found" };

            let events = [...timeline];
            if (args.type_filter) {
                events = events.filter(e => e.type === args.type_filter);
            }
            // Sort by Date Descending
            events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (args.limit) events = events.slice(0, args.limit);

            return { status: "Success", events: events };
        });

        // =========================================================================
        // Search & Retrieval (GUI)
        // =========================================================================

        this.registerTool('get_lead', 'Get full lead profile and timeline', {
            type: 'object',
            properties: {
                phone: { type: 'string' }
            },
            required: ['phone']
        }, async (args) => {
            const lead = await this._findLeadByPhone(args.phone);
            if (!lead) return { status: "Not Found" };

            const timeline = this.timelines.get(lead.lead_id) || [];
            // Return copy of timeline to prevent mutation? Implementation returns ref usually but test expects immutable.
            // Tests check retrieval.
            return { status: "Found", lead: lead, timeline: timeline };
        });

        this.registerTool('get_lead_by_phone', 'Strict lookup by phone', {
            type: 'object',
            properties: {
                phone: { type: 'string' }
            },
            required: ['phone']
        }, async (args) => {
            const lead = await this._findLeadByPhone(args.phone);
            if (!lead) return { status: "Not Found" };
            return { status: "Found", lead: lead };
        });

        this.registerTool('search_leads', 'Fuzzy search', {
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'integer' },
                offset: { type: 'integer' }
            },
            required: ['query']
        }, async (args) => {
            const q = args.query.toLowerCase();
            const results = [];
            const limit = args.limit || 20;
            const offset = args.offset || 0;

            for (const lead of this.leads.values()) {
                if (lead.name.toLowerCase().includes(q) ||
                    lead.lead_id.includes(q) ||
                    (lead.email && lead.email.toLowerCase().includes(q))) {
                    results.push(lead);
                }
            }

            const page = results.slice(offset, offset + limit);
            return { count: results.length, leads: page };
        });

        this.registerTool('get_leads_by_status', 'Filter by status', {
            type: 'object',
            properties: {
                status: { type: 'string' },
                limit: { type: 'integer' },
                offset: { type: 'integer' }
            },
            required: ['status']
        }, async (args) => {
            const results = [];
            for (const lead of this.leads.values()) {
                if (lead.status === args.status) results.push(lead);
            }
            const limit = args.limit || 20;
            const offset = args.offset || 0;
            return { count: results.length, leads: results.slice(offset, offset + limit) };
        });

        this.registerTool('get_recent_leads', 'Get recently active leads', {
            type: 'object',
            properties: {
                limit: { type: 'integer' }
            }
        }, async (args) => {
            const allLeads = Array.from(this.leads.values());
            // Sort by Created At for now (Ideal: Last Interaction Date)
            allLeads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return { leads: allLeads.slice(0, args.limit || 10) };
        });

        this.registerTool('get_dashboard_stats', 'Get CRM stats', {
            type: 'object', properties: {}
        }, async (args) => {
            const stats = {
                total_leads: this.leads.size,
                enquiry: 0,
                visited: 0,
                onboarded: 0,
                left: 0
            };
            for (const lead of this.leads.values()) {
                if (stats[lead.status.toLowerCase()] !== undefined) {
                    stats[lead.status.toLowerCase()]++;
                }
            }
            return stats;
        });

        // =========================================================================
        // Artifacts
        // =========================================================================

        this.registerTool('link_artifact', 'Link file to lead', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                file_url: { type: 'string' },
                file_type: { type: 'string' },
                description: { type: 'string' }
            },
            required: ['lead_id', 'file_url']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            const event = this._logEvent(args.lead_id, 'ARTIFACT_LINKED', {
                url: args.file_url,
                file_type: args.file_type || 'Generic',
                description: args.description
            });

            return { status: "Artifact Linked", event_id: event.event_id };
        });

        this.registerTool('get_lead_artifacts', 'Get linked files', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                type_filter: { type: 'string' }
            },
            required: ['lead_id']
        }, async (args) => {
            const timeline = this.timelines.get(args.lead_id);
            if (!timeline) return { status: "Error", message: "Lead not found" };

            // Scan timeline for ARTIFACT_LINKED events AND SESSION events with links
            const artifacts = [];

            for (const evt of timeline) {
                if (evt.type === 'ARTIFACT_LINKED') {
                    if (!args.type_filter || evt.file_type === args.type_filter) {
                        artifacts.push({ url: evt.url, description: evt.description, date: evt.timestamp, type: evt.file_type });
                    }
                }
                if (evt.type === 'SESSION' && evt.links && evt.links.artifacts) {
                    for (const art of evt.links.artifacts) {
                        // Assuming string URL or object. Handling string for now.
                        artifacts.push({ url: art, source_event: evt.event_id, date: evt.timestamp, type: 'SessionArtifact' });
                    }
                }
            }
            return { count: artifacts.length, artifacts: artifacts };
        });
    }

    // --- Helper Methods ---

    async _findLeadByPhone(phone) {
        if (this.leads.has(phone)) return this.leads.get(phone);
        for (const lead of this.leads.values()) {
            if (lead.phones.others.some(p => p.number === phone)) {
                return lead;
            }
        }
        return null;
    }

    _logEvent(leadId, type, data) {
        let timeline = this.timelines.get(leadId);
        if (!timeline) {
            timeline = [];
            this.timelines.set(leadId, timeline);
        }

        const event = {
            event_id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            type: type,
            ...data
        };
        timeline.push(event);
        return event;
    }
}

module.exports = CRMAgent;
