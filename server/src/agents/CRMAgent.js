const BaseAgent = require('./BaseAgent');
const PhoneNormalizationService = require('../services/PhoneNormalizationService');
const TimeAuthorityService = require('../services/TimeAuthorityService');
const TenantDataStore = require('../storage/TenantDataStore');
const BusinessConfig = require('../config/business');

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
                    'get_lead', 'get_lead_by_phone', 'get_lead_by_email', 'search_leads', 'get_leads_by_status', 'get_recent_leads', 'get_dashboard_stats', 'get_merge_candidates',
                    'link_artifact', 'get_lead_artifacts'
                ]
            },
            directives: {
                goals: ['Single customer view', 'Merge duplicates'],
                constraints: ['Privacy respected', 'Append-only timeline']
            }
        });

        this.defaultTenantId = BusinessConfig.DEFAULT_TENANT_ID || 'default';
        this.dataBackend = process.env.STORAGE_BACKEND || (process.env.NODE_ENV === 'test' ? 'memory' : 'local');
        this._activeTenantId = null;
        this._tenantStates = new Map();
        this._tenantStores = new Map();
        this._businessConfigProvider = (tenantId) => {
            if (typeof BusinessConfig.getBusinessConfig === 'function') {
                return BusinessConfig.getBusinessConfig(tenantId);
            }
            return BusinessConfig;
        };

        this.registerTools();
    }

    _extractTenantId(args = {}) {
        return args.tenant_id || this.defaultTenantId;
    }

    _getTenantStore(tenantId) {
        if (!this._tenantStores.has(tenantId)) {
            this._tenantStores.set(
                tenantId,
                new TenantDataStore({
                    tenantId,
                    namespace: 'crm',
                    backend: this.dataBackend
                })
            );
        }
        return this._tenantStores.get(tenantId);
    }

    _hydrateMapsFromStore(rawState) {
        const leadsMap = new Map();
        const timelineMap = new Map();

        if (Array.isArray(rawState?.leads)) {
            rawState.leads.forEach((lead) => {
                if (lead && lead.lead_id) {
                    leadsMap.set(lead.lead_id, lead);
                }
            });
        } else if (rawState?.leads && typeof rawState.leads === 'object') {
            Object.entries(rawState.leads).forEach(([leadId, lead]) => {
                if (leadId) {
                    leadsMap.set(leadId, lead);
                }
            });
        }

        if (Array.isArray(rawState?.timelines)) {
            rawState.timelines.forEach((entry) => {
                if (entry && entry.lead_id) {
                    timelineMap.set(entry.lead_id, entry.events || []);
                }
            });
        } else if (rawState?.timelines && typeof rawState.timelines === 'object') {
            Object.entries(rawState.timelines).forEach(([leadId, events]) => {
                timelineMap.set(leadId, Array.isArray(events) ? events : []);
            });
        }

        return {
            leads: leadsMap,
            timelines: timelineMap,
            mergeReviews: new Map(Object.entries(rawState?.mergeReviews || {})),
            businessConfig: rawState?.businessConfig || null,
            lastUpdatedAt: rawState?.lastUpdatedAt || TimeAuthorityService.nowIST()
        };
    }

    _getState(tenantId = this.defaultTenantId) {
        const resolvedTenantId = tenantId || this.defaultTenantId;
        if (!this._tenantStates.has(resolvedTenantId)) {
            const store = this._getTenantStore(resolvedTenantId);
            const rawState = store.load({
                leads: {},
                timelines: {},
                lastUpdatedAt: TimeAuthorityService.nowIST()
            });
            const hydrated = this._hydrateMapsFromStore(rawState);
            this._tenantStates.set(resolvedTenantId, hydrated);
        }
        return this._tenantStates.get(resolvedTenantId);
    }

    async _hydrateTenantState(tenantId = this.defaultTenantId) {
        const resolvedTenantId = tenantId || this.defaultTenantId;
        const store = this._getTenantStore(resolvedTenantId);
        const rawState = await store.hydrate({
            leads: {},
            timelines: {},
            lastUpdatedAt: TimeAuthorityService.nowIST()
        });
        const hydrated = this._hydrateMapsFromStore(rawState);
        this._tenantStates.set(resolvedTenantId, hydrated);
        return hydrated;
    }

    async _saveState(tenantId) {
        const state = this._getState(tenantId);
        const payload = {
            leads: Object.fromEntries(state.leads.entries()),
            timelines: Object.fromEntries(
                [...state.timelines.entries()].map(([leadId, events]) => [
                    leadId,
                    Array.isArray(events) ? events : []
                ])
            ),
            mergeReviews: Object.fromEntries(state.mergeReviews.entries()),
            lastUpdatedAt: TimeAuthorityService.nowIST(),
            businessConfig: this._businessConfigProvider(tenantId)
        };
        await this._getTenantStore(tenantId).save(payload);
    }

    _getActiveBusinessConfig(tenantId = this.defaultTenantId) {
        return this._businessConfigProvider(tenantId) || this._businessConfigProvider(this.defaultTenantId);
    }

    _getTenantStateCounts(tenantId = this.defaultTenantId) {
        const state = this._getState(tenantId);
        return {
            leads: state.leads.size,
            timelines: state.timelines.size,
            mergeReviews: state.mergeReviews.size
        };
    }

    _setTenantContext(tenantId) {
        const normalizedTenantId = this._extractTenantId({ tenant_id: tenantId });
        const previousTenantId = this._activeTenantId;
        this._activeTenantId = normalizedTenantId;
        this._getState(normalizedTenantId);
        return previousTenantId;
    }

    get leads() {
        return this._getState(this._activeTenantId || this.defaultTenantId).leads;
    }

    get timelines() {
        return this._getState(this._activeTenantId || this.defaultTenantId).timelines;
    }

    get mergeReviews() {
        return this._getState(this._activeTenantId || this.defaultTenantId).mergeReviews;
    }

    _normalizeSearchFilter(value) {
        if (typeof value !== 'string') return '';
        return value.trim();
    }

    _matchesLeadFilters(lead, filters = {}) {
        const normalizedStatus = this._normalizeSearchFilter(filters.status);
        const normalizedProfileType = this._normalizeSearchFilter(filters.profile_type);

        if (normalizedStatus && normalizedStatus !== 'ALL' && lead.status !== normalizedStatus) {
            return false;
        }

        if (normalizedProfileType && normalizedProfileType !== 'ALL' && (lead.profile_type || 'Customer') !== normalizedProfileType) {
            return false;
        }

        return true;
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
            let leadId;
            try {
                leadId = PhoneNormalizationService.normalizeToE164(args.primary_phone);
            } catch (err) {
                return { status: "Invalid Input", message: "Invalid primary phone number format" };
            }

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

            const now = TimeAuthorityService.nowIST();
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
                created_at: now,
                timezone: args.timezone || 'Asia/Kolkata',
                date_format: args.date_format || 'DD-MM-YYYY'
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
                changed_at: TimeAuthorityService.nowIST()
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
                changed_at: TimeAuthorityService.nowIST()
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

            // Re-sort timeline by timestamp (Sorting must use timestamp_ist as per spec)
            targetTimeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

            // 3. Log Merge Event
            this._logEvent(args.target_lead_id, 'MERGE', {
                absorbed_lead_id: args.source_lead_id,
                relationship: args.relationship,
                reason: 'Identity Resolution'
            });

            // 4. Delete Source
            this.leads.delete(args.source_lead_id);
            this.timelines.delete(args.source_lead_id);
            for (const [reviewId, review] of this.mergeReviews.entries()) {
                if (
                    review.source_lead_id === args.source_lead_id ||
                    review.target_lead_id === args.source_lead_id ||
                    review.source_lead_id === args.target_lead_id ||
                    review.target_lead_id === args.target_lead_id
                ) {
                    this.mergeReviews.delete(reviewId);
                }
            }

            return { status: "Merge Complete", surviving_lead_id: args.target_lead_id };
        });

        this.registerTool('upsert_merge_review', 'Create or refresh a pending merge review request', {
            type: 'object',
            properties: {
                source_lead_id: { type: 'string' },
                target_lead_id: { type: 'string' },
                relationship: { type: 'string' },
                reasoning: { type: 'string' },
                triggered_by_event_id: { type: 'string' },
                confidence: { type: 'number' }
            },
            required: ['source_lead_id', 'target_lead_id', 'reasoning']
        }, async (args) => {
            const source = this.leads.get(args.source_lead_id);
            const target = this.leads.get(args.target_lead_id);
            if (!source || !target) return { status: "Error", message: "One or both leads not found" };
            if (args.source_lead_id === args.target_lead_id) {
                return { status: "Error", message: "Source and target lead cannot be same" };
            }

            const existingForLead = Array.from(this.mergeReviews.entries()).find(([, review]) =>
                review.source_lead_id === args.source_lead_id ||
                review.target_lead_id === args.source_lead_id ||
                review.source_lead_id === args.target_lead_id ||
                review.target_lead_id === args.target_lead_id
            );

            const reviewId = existingForLead?.[0] || `MRG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const current = existingForLead?.[1] || {};
            const nextReview = {
                review_id: reviewId,
                source_lead_id: args.source_lead_id,
                target_lead_id: args.target_lead_id,
                relationship: args.relationship || 'Duplicate',
                reasoning: args.reasoning,
                triggered_by_event_id: args.triggered_by_event_id || null,
                confidence: typeof args.confidence === 'number' ? args.confidence : null,
                status: 'PENDING',
                created_at: current.created_at || TimeAuthorityService.nowIST(),
                updated_at: TimeAuthorityService.nowIST()
            };

            this.mergeReviews.set(reviewId, nextReview);
            const reviewEvent = this._logEvent(args.source_lead_id, 'MERGE_REVIEW', {
                review_id: reviewId,
                target_lead_id: args.target_lead_id,
                relationship: nextReview.relationship,
                reasoning: nextReview.reasoning,
                triggered_by_event_id: nextReview.triggered_by_event_id
            });

            return {
                status: existingForLead ? "Merge Review Updated" : "Merge Review Created",
                review_id: reviewId,
                event_id: reviewEvent.event_id
            };
        });

        // =========================================================================
        // Profile Management
        // =========================================================================

        this.registerTool('update_lead_snapshot', 'Enrich lead profile fields', {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                name: { type: 'string' },
                demographics: { type: 'object' },
                preferences: { type: 'array', items: { type: 'string' } },
                email: { type: 'string' },
                source: { type: 'object' },
                ai_notes: { type: 'object' },
                profile_type: { type: 'string', enum: ['Customer', 'Staff', 'CEO'] },
                timezone: { type: 'string' },
                date_format: { type: 'string' }
            },
            required: ['lead_id']
        }, async (args) => {
            const lead = this.leads.get(args.lead_id);
            if (!lead) return { status: "Error", message: "Lead not found" };

            if (args.name) lead.name = args.name;
            if (args.demographics) lead.demographics = { ...lead.demographics, ...args.demographics };
            if (args.preferences) lead.preferences = args.preferences;
            if (args.email) lead.email = args.email;
            if (args.source) lead.source = args.source;
            if (args.ai_notes) lead.ai_notes = { ...lead.ai_notes, ...args.ai_notes };
            if (args.profile_type) lead.profile_type = args.profile_type;
            if (args.timezone) lead.timezone = args.timezone;
            if (args.date_format) lead.date_format = args.date_format;
            if (args.demographics?.unit_type_required) lead.unit_type_required = args.demographics.unit_type_required;

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

            let phoneNumber;
            try {
                phoneNumber = PhoneNormalizationService.normalizeToE164(args.phone_number);
            } catch (err) {
                return { status: "Invalid Input", message: "Invalid phone number format" };
            }

            if (lead.phones.others.find(p => p.number === phoneNumber)) {
                return { status: "Exists", message: "Number already in secondary list" };
            }
            lead.phones.others.push({ number: phoneNumber, label: args.label, whatsapp: false });
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

            let phoneNumber;
            try {
                phoneNumber = PhoneNormalizationService.normalizeToE164(args.phone_number);
            } catch (err) {
                return { status: "Invalid Input", message: "Invalid phone number format" };
            }

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
            events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

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
            let phone;
            try {
                phone = PhoneNormalizationService.normalizeToE164(args.phone);
            } catch (err) {
                return { status: "Invalid Input", message: "Invalid phone number format" };
            }

            const lead = await this._findLeadByPhone(phone);
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
            let phone;
            try {
                phone = PhoneNormalizationService.normalizeToE164(args.phone);
            } catch (err) {
                return { status: "Invalid Input", message: "Invalid phone number format" };
            }

            const lead = await this._findLeadByPhone(phone);
            if (!lead) return { status: "Not Found" };
            return { status: "Found", lead: lead };
        });

        this.registerTool('get_lead_by_email', 'Lookup lead by email address (case-insensitive)', {
            type: 'object',
            properties: {
                email: { type: 'string' }
            },
            required: ['email']
        }, async (args) => {
            if (!args.email || typeof args.email !== 'string') {
                return { status: "Invalid Input", message: "Email is required" };
            }
            const email = args.email.toLowerCase().trim();

            for (const lead of this.leads.values()) {
                if (lead.email && lead.email.toLowerCase().trim() === email) {
                    return { status: "Found", lead: lead };
                }
            }
            return { status: "Not Found" };
        });

        this.registerTool('search_leads', 'Fuzzy search', {
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                status: { type: 'string' },
                profile_type: { type: 'string', enum: ['ALL', 'Customer', 'Staff', 'CEO'] }
            },
            required: ['query']
        }, async (args) => {
            const q = args.query.toLowerCase();
            const results = [];
            const limit = args.limit || 20;
            const offset = args.offset || 0;

            for (const lead of this.leads.values()) {
                if (!this._matchesLeadFilters(lead, args)) {
                    continue;
                }

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
                limit: { type: 'integer' },
                status: { type: 'string' },
                profile_type: { type: 'string', enum: ['ALL', 'Customer', 'Staff', 'CEO'] }
            }
        }, async (args) => {
            const allLeads = Array.from(this.leads.values()).filter((lead) => this._matchesLeadFilters(lead, args));
            // Sort by Created At for now (Ideal: Last Interaction Date)
            allLeads.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
                left: 0,
                pending_follow_up: 0
            };
            for (const lead of this.leads.values()) {
                if (stats[lead.status.toLowerCase()] !== undefined) {
                    stats[lead.status.toLowerCase()]++;
                }
                if (lead.status === 'Enquiry' || lead.status === 'Visited') {
                    stats.pending_follow_up++;
                }
            }
            return stats;
        });

        this.registerTool('get_merge_candidates', 'Get system-flagged merge candidates for CEO review', {
            type: 'object',
            properties: {
                limit: { type: 'integer' }
            }
        }, async (args) => {
            const summarizeLead = (lead) => ({
                lead_id: lead.lead_id,
                name: lead.name || 'Unknown',
                status: lead.status || 'Unknown',
                email: lead.email || '',
                profile_type: lead.profile_type || 'Customer',
                source: lead.source || {},
                unit_type_required: lead.unit_type_required || lead.demographics?.unit_type_required || '',
                created_at: lead.created_at || ''
            });

            const candidates = Array.from(this.mergeReviews.values())
                .filter((review) => review.status === 'PENDING')
                .map((review) => ({
                    candidate_id: review.review_id,
                    confidence: review.confidence,
                    relationship: review.relationship,
                    reasons: [review.reasoning].filter(Boolean),
                    triggered_by_event_id: review.triggered_by_event_id,
                    source: summarizeLead(this.leads.get(review.source_lead_id) || { lead_id: review.source_lead_id }),
                    target: summarizeLead(this.leads.get(review.target_lead_id) || { lead_id: review.target_lead_id })
                }))
                .filter((candidate) => candidate.source.lead_id && candidate.target.lead_id);

            return { count: candidates.length, candidates: candidates.slice(0, args.limit || 10) };
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

    async callTool(name, args) {
        // Global interceptor for CRM Agent to normalize all identity-based arguments to E.164
        const tenantId = this._extractTenantId(args || {});
        const normalizedArgs = { ...(args || {}) };
        await this._hydrateTenantState(tenantId);
        const previousTenantId = this._setTenantContext(tenantId);

        if (!normalizedArgs.tenant_id) {
            normalizedArgs.tenant_id = tenantId;
        }

        const phoneArgs = ['lead_id', 'source_lead_id', 'target_lead_id', 'primary_phone', 'phone', 'phone_number'];

        for (const key of phoneArgs) {
            if (normalizedArgs[key] && typeof normalizedArgs[key] === 'string') {
                try {
                    normalizedArgs[key] = PhoneNormalizationService.normalizeToE164(normalizedArgs[key]);
                } catch (err) {
                    this._activeTenantId = previousTenantId;
                    return { status: "Invalid Input", message: `Invalid phone number format for ${key}: ${normalizedArgs[key]}` };
                }
            }
        }

        try {
            const result = await super.callTool(name, normalizedArgs);
            await this._saveState(tenantId);
            return result;
        } finally {
            this._activeTenantId = previousTenantId;
        }
    }

    async _findLeadByPhone(phone, tenantId = this._activeTenantId) {
        const state = this._getState(tenantId);
        if (state.leads.has(phone)) return state.leads.get(phone);
        for (const lead of state.leads.values()) {
            if (lead.phones.others.some(p => p.number === phone)) {
                return lead;
            }
        }
        return null;
    }

    _logEvent(leadId, type, data, tenantId = this._activeTenantId) {
        const state = this._getState(tenantId);
        let timeline = state.timelines.get(leadId);
        if (!timeline) {
            timeline = [];
            state.timelines.set(leadId, timeline);
        }

        const event = {
            event_id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: TimeAuthorityService.nowIST(),
            type: type,
            ...data
        };
        timeline.push(event);
        return event;
    }
}

module.exports = CRMAgent;
