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
const STAFF_SELF_HR_TOOL_NAMES = new Set([
    'get_staff_details',
    'get_salary_card',
    'get_staff_leaves',
    'calculate_incentive',
    'get_performance_metrics',
    'get_caretaker_activity',
]);
const STAFF_CRM_TOOL_NAMES = new Set([
    'add_lead',
    'change_status',
    'update_lead_snapshot',
    'add_secondary_phone',
    'log_session',
    'add_manual_note',
    'get_timeline',
    'get_lead',
    'get_lead_by_phone',
    'get_lead_by_email',
    'search_leads',
    'get_leads_by_status',
    'get_recent_leads',
    'get_dashboard_stats',
    'get_merge_candidates',
    'link_artifact',
    'get_lead_artifacts',
]);
const CUSTOMER_SELF_CRM_TOOL_NAMES = new Set([
    'get_lead',
    'get_lead_by_phone',
    'get_lead_by_email',
    'get_timeline',
    'get_lead_artifacts',
]);
const STAFF_PROPERTY_READ_TOOL_NAMES = new Set([
    'get_properties',
    'get_units',
    'get_meters',
    'calculate_deposit',
    'get_public_rate_card',
    'get_amenities',
    'get_analytics_stats',
    'get_maintenance_reqs',
]);
const CUSTOMER_PROPERTY_READ_TOOL_NAMES = new Set([
    'get_properties',
    'get_units',
    'calculate_deposit',
    'get_public_rate_card',
    'get_amenities',
]);
const CHAT_ACCESS_POLICY = {
    CEO: {
        HRAgent: { mode: 'full' },
        CRMAgent: { mode: 'full' },
        PropertyAI: { mode: 'full' },
        FinanceAI: { mode: 'reserved_for_v2' },
    },
    Staff: {
        HRAgent: { mode: 'self_only', toolNames: STAFF_SELF_HR_TOOL_NAMES },
        CRMAgent: { mode: 'operational_full', toolNames: STAFF_CRM_TOOL_NAMES },
        PropertyAI: { mode: 'read_only', toolNames: STAFF_PROPERTY_READ_TOOL_NAMES },
        FinanceAI: { mode: 'reserved_for_v2' },
    },
    Customer: {
        HRAgent: { mode: 'none', toolNames: new Set() },
        CRMAgent: { mode: 'self_only', toolNames: CUSTOMER_SELF_CRM_TOOL_NAMES },
        PropertyAI: { mode: 'public_and_own', toolNames: CUSTOMER_PROPERTY_READ_TOOL_NAMES },
        FinanceAI: { mode: 'reserved_for_v2' },
    },
};

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

        // Session Manager: Map<tenantId::sessionKey, ConversationSession>
        this.defaultTenantId = BusinessConfig.DEFAULT_TENANT_ID || 'default';
        this.sessions = new Map();
        const defaultConfig = typeof BusinessConfig.getBusinessConfig === 'function'
            ? BusinessConfig.getBusinessConfig(this.defaultTenantId)
            : BusinessConfig;
        this.SESSION_TIMEOUT_MS = defaultConfig?.persona?.session_timeout_ms || 15 * 60 * 1000; // 15 Minutes
        this.financeAuthorizationRequests = new Map();

        ensurePredefinedFinancialWorkflows(workflowStore);

        this._setupSelfTools();
        this._attachedAgentNames = new Set();
        this.attachAgentListeners(otherAgents);
    }

    _normalizeTenantId(tenantId) {
        const normalized = typeof tenantId === 'string' ? tenantId.trim() : '';
        return normalized || this.defaultTenantId;
    }

    _getTenantIdFromContext(context = {}) {
        const safeContext = context || {};
        return this._normalizeTenantId(safeContext.tenant_id || safeContext.tenantId || safeContext.business_id);
    }

    _buildSessionMapKey(tenantId, sessionKey) {
        return `${this._normalizeTenantId(tenantId)}::${sessionKey}`;
    }

    _buildAuthRequestKey(tenantId, authorizationId) {
        return `${this._normalizeTenantId(tenantId)}::${authorizationId}`;
    }

    _extractTenantFromArgs(args = {}) {
        return this._getTenantIdFromContext(args);
    }

    _getAuthRequest(authorization_id, tenantId = this.defaultTenantId) {
        const direct = this.financeAuthorizationRequests.get(this._buildAuthRequestKey(tenantId, authorization_id));
        if (direct) return direct;

        for (const request of this.financeAuthorizationRequests.values()) {
            if (request.authorization_id === authorization_id) {
                return request;
            }
        }

        return undefined;
    }

    _setAuthRequest(authorization_id, tenantId, request) {
        this.financeAuthorizationRequests.set(this._buildAuthRequestKey(tenantId, authorization_id), request);
    }

    _listPendingFinanceRequests(tenantId = null) {
        const allRequests = Array.from(this.financeAuthorizationRequests.values())
            .filter(r => r && r.status === 'PENDING_CEO_AUTHORIZATION');

        if (!tenantId) return allRequests;
        const normalizedTenantId = this._normalizeTenantId(tenantId);
        return allRequests.filter((request) => request.tenant_id === normalizedTenantId);
    }

    _buildTenantContextArgs(args = {}, tenantId = this.defaultTenantId) {
        if (!args || typeof args !== 'object') return { tenant_id: tenantId };
        return {
            ...args,
            tenant_id: args.tenant_id || args.tenantId || tenantId
        };
    }

    _getRuntimeConfig(tenantId = this.defaultTenantId) {
        return typeof BusinessConfig.getBusinessConfig === 'function'
            ? BusinessConfig.getBusinessConfig(tenantId)
            : BusinessConfig;
    }

    _getConversationRole(userContext = {}, runtimePersona = {}) {
        const ceoEmail = String(runtimePersona?.ceo_email || '').trim().toLowerCase();
        const contextEmail = String(userContext?.email || '').trim().toLowerCase();
        if ((contextEmail && contextEmail === ceoEmail) || userContext?.profile_type === 'CEO') {
            return 'CEO';
        }
        if (userContext?.profile_type === 'Staff') {
            return 'Staff';
        }
        return 'Customer';
    }

    _extractUserPhoneCandidates(userContext = {}) {
        const rawCandidates = [
            userContext?.lead_id,
            userContext?.phone,
            userContext?.phones?.primary?.number,
            ...((userContext?.phones?.others || []).map((entry) => entry?.number)),
        ].filter(Boolean);

        const normalized = [];
        rawCandidates.forEach((value) => {
            try {
                normalized.push(PhoneNormalizationService.normalizeToE164(value));
            } catch (_err) {
                // Ignore non-phone identifiers such as lead ids that are not valid phone numbers.
            }
        });
        return Array.from(new Set(normalized));
    }

    async _resolveOwnStaffMember(userContext = {}, tenantId = this.defaultTenantId) {
        const hrAgent = this.subAgents.find((agent) => agent.name === 'HRAgent');
        if (!hrAgent) return null;

        const staffRows = await hrAgent.callTool('get_all_staff', this._buildTenantContextArgs({}, tenantId));
        if (!Array.isArray(staffRows)) return null;

        const candidatePhones = this._extractUserPhoneCandidates(userContext);
        const candidateEmail = String(userContext?.email || '').trim().toLowerCase();

        return staffRows.find((staffMember) => {
            const staffPhone = String(staffMember?.contact?.primary || '').trim();
            const staffEmail = String(staffMember?.contact?.email || '').trim().toLowerCase();
            if (staffPhone && candidatePhones.includes(staffPhone)) return true;
            if (candidateEmail && staffEmail && candidateEmail === staffEmail) return true;
            return false;
        }) || null;
    }

    async _resolveOwnCrmLead(userContext = {}, tenantId = this.defaultTenantId) {
        const crmAgent = this.subAgents.find((agent) => agent.name === 'CRMAgent');
        if (!crmAgent) return null;

        const candidatePhones = this._extractUserPhoneCandidates(userContext);
        const candidateEmail = String(userContext?.email || '').trim().toLowerCase();

        for (const phone of candidatePhones) {
            const lookup = await crmAgent.callTool('get_lead_by_phone', this._buildTenantContextArgs({ phone }, tenantId));
            if (lookup?.status === 'Found' && lookup.lead) {
                return lookup.lead;
            }
        }

        if (candidateEmail) {
            const lookup = await crmAgent.callTool('get_lead_by_email', this._buildTenantContextArgs({ email: candidateEmail }, tenantId));
            if (lookup?.status === 'Found' && lookup.lead) {
                return lookup.lead;
            }
        }

        return null;
    }

    _getChatAccessRule(agent, identityContext = {}) {
        if (!agent?.name) {
            return { mode: 'full', toolNames: null };
        }

        const rolePolicy = CHAT_ACCESS_POLICY[identityContext.role] || {};
        const rule = rolePolicy[agent.name];
        if (!rule) {
            return { mode: 'full', toolNames: null };
        }

        if (rule.mode === 'self_only' && agent.name === 'HRAgent' && !identityContext.ownStaffMember?.id) {
            return { mode: 'none', toolNames: new Set() };
        }

        if (rule.mode === 'self_only' && agent.name === 'CRMAgent' && !identityContext.ownCrmLead?.lead_id) {
            return { mode: 'none', toolNames: new Set() };
        }

        return rule;
    }

    _getChatVisibleTools(agent, identityContext = {}) {
        const rule = this._getChatAccessRule(agent, identityContext);
        if (rule.mode === 'full' || !rule.toolNames) {
            return agent.getTools();
        }

        return agent.getTools().filter((tool) => rule.toolNames.has(tool.name));
    }

    _scopeCustomerCrmArgs(toolName, args, ownCrmLead = null) {
        if (!ownCrmLead?.lead_id) {
            throw new Error('Customer CRM scope could not be resolved.');
        }

        switch (toolName) {
            case 'get_lead':
            case 'get_lead_by_phone':
                return {
                    ...args,
                    phone: ownCrmLead.lead_id,
                };
            case 'get_lead_by_email':
                if (!ownCrmLead.email) {
                    throw new Error('Customer CRM email is not available for lookup.');
                }
                return {
                    ...args,
                    email: ownCrmLead.email,
                };
            case 'get_timeline':
            case 'get_lead_artifacts':
                return {
                    ...args,
                    lead_id: ownCrmLead.lead_id,
                };
            default:
                throw new Error('Customer can only access their own CRM record over chat.');
        }
    }

    _scopeChatToolArgs(agent, toolName, args, identityContext = {}) {
        const rule = this._getChatAccessRule(agent, identityContext);
        if (rule.mode === 'full' || !CHAT_ACCESS_POLICY[identityContext.role]?.[agent?.name]) {
            return args;
        }

        if (rule.mode === 'reserved_for_v2') {
            throw new Error(`${agent.name} access policy is reserved for a future phase.`);
        }

        if (rule.mode === 'none') {
            throw new Error(`${identityContext.role} cannot access ${agent.name} over chat.`);
        }

        if (rule.toolNames && !rule.toolNames.has(toolName)) {
            throw new Error(`${identityContext.role} cannot access ${agent.name}.${toolName} over chat.`);
        }

        if (agent?.name === 'HRAgent') {
            if (!identityContext.ownStaffMember?.id) {
                throw new Error('Staff profile could not be resolved for HR access.');
            }

            return {
                ...args,
                staff_id: identityContext.ownStaffMember.id,
            };
        }

        if (agent?.name === 'CRMAgent' && identityContext.role === 'Customer') {
            return this._scopeCustomerCrmArgs(toolName, args, identityContext.ownCrmLead);
        }

        return args;
    }

    _sanitizeCustomerPropertyRecord(record = {}, ownLeadId = null) {
        if (!record || typeof record !== 'object') return record;

        return {
            id: record.id,
            property_id: record.property_id,
            unit_number: record.unit_number,
            floor: record.floor,
            types: Array.isArray(record.types) ? record.types : [],
            amenities: Array.isArray(record.amenities) ? record.amenities : [],
            base_rent: record.base_rent,
            rate_card: record.rate_card || null,
            status: record.status,
            own_booking: Boolean(ownLeadId && record.tenant_id === ownLeadId),
        };
    }

    _sanitizeCustomerPropertySummary(record = {}) {
        if (!record || typeof record !== 'object') return record;

        return {
            id: record.id,
            name: record.name,
            address: record.address,
            pin_code: record.pin_code,
            area: record.area,
            city: record.city,
            state: record.state,
            description: record.description,
            amenities: Array.isArray(record.amenities) ? record.amenities : [],
            floors: record.floors,
            image_urls: Array.isArray(record.image_urls) ? record.image_urls : [],
            thumbnail_url: record.thumbnail_url || '',
            status: record.status,
        };
    }

    _sanitizeCustomerPropertyResult(toolName, result, identityContext = {}) {
        const ownLeadId = identityContext.ownCrmLead?.lead_id || null;
        if (!result || typeof result !== 'object') return result;
        if (result.error || result.status === 'Failed') return result;

        if (toolName === 'get_properties') {
            if (Array.isArray(result)) {
                return result.map((record) => this._sanitizeCustomerPropertySummary(record));
            }
            return this._sanitizeCustomerPropertySummary(result);
        }

        if (toolName === 'get_units') {
            const includeRecord = (record) => record?.status === 'AVAILABLE' || (ownLeadId && record?.tenant_id === ownLeadId);

            if (Array.isArray(result)) {
                return result
                    .filter((record) => includeRecord(record))
                    .map((record) => this._sanitizeCustomerPropertyRecord(record, ownLeadId));
            }

            if (!includeRecord(result)) {
                return { error: 'Not found' };
            }

            return this._sanitizeCustomerPropertyRecord(result, ownLeadId);
        }

        return result;
    }

    _sanitizeChatToolResult(agent, toolName, result, identityContext = {}) {
        if (agent?.name === 'PropertyAI' && identityContext.role === 'Customer') {
            return this._sanitizeCustomerPropertyResult(toolName, result, identityContext);
        }

        return result;
    }

    attachAgentListeners(agents = []) {
        const safeAgents = Array.isArray(agents) ? agents : [agents];
        safeAgents.forEach((agent) => {
            if (!agent || !agent.name || this._attachedAgentNames.has(agent.name)) return;
            if (agent.name === 'HRAgent') {
                agent.on('staff.hired', (payload) => {
                    this.process_event({
                        event_type: 'staff.hired',
                        payload,
                        context: {
                            tenant_id: payload?.tenant_id,
                            source_agent: agent.name,
                        },
                    }).catch((error) => {
                        console.error(`[MasterAI] staff.hired handling failed: ${error.message}`);
                        this._emitSystemEvent('staff.crm_sync.failed', null, {
                            staff_id: payload?.staff_id || null,
                            tenant_id: payload?.tenant_id || this.defaultTenantId,
                            error: error.message,
                        });
                    });
                });
                agent.on('staff.profile_updated', (payload) => {
                    this.process_event({
                        event_type: 'staff.profile_updated',
                        payload,
                        context: {
                            tenant_id: payload?.tenant_id,
                            source_agent: agent.name,
                        },
                    }).catch((error) => {
                        console.error(`[MasterAI] staff.profile_updated handling failed: ${error.message}`);
                        this._emitSystemEvent('staff.crm_sync.failed', null, {
                            staff_id: payload?.staff_id || null,
                            tenant_id: payload?.tenant_id || this.defaultTenantId,
                            error: error.message,
                            event_type: 'staff.profile_updated',
                        });
                    });
                });
            }
            this._attachedAgentNames.add(agent.name);
        });
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

    _isCeoApprover(identity, tenantId = this.defaultTenantId) {
        if (!identity) return false;
        const config = typeof BusinessConfig.getBusinessConfig === 'function'
            ? BusinessConfig.getBusinessConfig(tenantId)
            : BusinessConfig;
        const ceoEmail = (config.persona?.ceo_email || '').toLowerCase();
        const ceoPhone = config.persona?.ceo_phone;
        return String(identity).toLowerCase() === ceoEmail || identity === ceoPhone;
    }

    _createFinanceAuthorizationRequest(toolName, args, workflowId, source, tenantId = this.defaultTenantId) {
        const normalizedTenantId = this._normalizeTenantId(tenantId);
        const authorization_id = `FIN-AUTH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const request = {
            tenant_id: normalizedTenantId,
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
        this._setAuthRequest(authorization_id, normalizedTenantId, request);
        return request;
    }

    async _syncStaffProfileToCrm(payload = {}, tenantId = this.defaultTenantId) {
        const normalizedTenantId = this._normalizeTenantId(tenantId || payload?.tenant_id);
        const crm = this.subAgents.find(a => a.name === 'CRMAgent');
        if (!crm) {
            throw new Error('CRMAgent not connected to MasterAI');
        }

        const primaryPhone = payload?.contact?.primary;
        const email = String(payload?.contact?.email || '').trim().toLowerCase() || null;
        if (!primaryPhone) {
            throw new Error('staff event missing contact.primary');
        }

        let lookup = null;

        const candidatePhones = [
            payload?.contact?.primary,
            payload?.previous_contact?.primary,
        ].filter(Boolean);

        for (const phone of candidatePhones) {
            const byPhone = await crm.callTool('get_lead_by_phone', this._buildTenantContextArgs({ phone }, normalizedTenantId));
            if (byPhone?.status === 'Found' && byPhone.lead) {
                lookup = byPhone.lead;
                break;
            }
        }

        const candidateEmails = [
            email,
            String(payload?.previous_contact?.email || '').trim().toLowerCase() || null,
        ].filter(Boolean);

        if (!lookup) {
            for (const candidateEmail of candidateEmails) {
                const byEmail = await crm.callTool('get_lead_by_email', this._buildTenantContextArgs({ email: candidateEmail }, normalizedTenantId));
                if (byEmail?.status === 'Found' && byEmail.lead) {
                    lookup = byEmail.lead;
                    break;
                }
            }
        }

        if (lookup) {
            await crm.callTool('update_lead_snapshot', this._buildTenantContextArgs({
                lead_id: lookup.lead_id,
                name: payload?.name || undefined,
                email: email || undefined,
                profile_type: 'Staff',
            }, normalizedTenantId));

            const knownPhones = new Set([
                lookup.lead_id,
                lookup.phones?.primary?.number,
                ...((lookup.phones?.others || []).map((entry) => entry?.number)),
            ].filter(Boolean));

            if (primaryPhone && !knownPhones.has(primaryPhone)) {
                await crm.callTool('add_secondary_phone', this._buildTenantContextArgs({
                    lead_id: lookup.lead_id,
                    phone_number: primaryPhone,
                    label: 'HR Staff Contact',
                }, normalizedTenantId));
            }

            return { mode: 'updated', lead_id: lookup.lead_id };
        }

        const created = await crm.callTool('add_lead', this._buildTenantContextArgs({
            name: payload?.name || 'Staff Member',
            primary_phone: primaryPhone,
            email: email || undefined,
            profile_type: 'Staff',
            source: { category: 'HR', detail: 'staff.hired' },
        }, normalizedTenantId));

        return { mode: 'created', lead_id: created?.lead_id || primaryPhone };
    }

    async _executeDeterministicFinanceWorkflow(toolName, args, source = 'chat', tenantId = this.defaultTenantId) {
        const normalizedTenantId = this._normalizeTenantId(tenantId);
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
            const pending = this._createFinanceAuthorizationRequest(toolName, args, workflowId, source, normalizedTenantId);
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

        if (!this._isCeoApprover(args?.approved_by, normalizedTenantId)) {
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
        const result = await financeAgent.callTool(toolName, this._buildTenantContextArgs(financeArgs, normalizedTenantId));
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
            properties: {
                tenant_id: { type: 'string' }
            }
        }, async (args = {}) => {
            const tenantId = this._getTenantIdFromContext(args);
            const pending = this._listPendingFinanceRequests(tenantId || null);
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
            const tenantId = this._getTenantIdFromContext(args);
            const request = this._getAuthRequest(args.authorization_id, tenantId);
            if (!request) {
                return { success: false, status: 'NOT_FOUND', error: `Authorization request '${args.authorization_id}' not found.` };
            }
            if (request.status !== 'PENDING_CEO_AUTHORIZATION') {
                return { success: false, status: request.status, error: `Authorization request is already ${request.status}.` };
            }
            if (!this._isCeoApprover(args.approved_by, request.tenant_id || tenantId)) {
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
                'authorization',
                request.tenant_id || tenantId
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
            const tenantId = this._getTenantIdFromContext(args);
            const request = this._getAuthRequest(args.authorization_id, tenantId);
            if (!request) {
                return { success: false, status: 'NOT_FOUND', error: `Authorization request '${args.authorization_id}' not found.` };
            }
            if (request.status !== 'PENDING_CEO_AUTHORIZATION') {
                return { success: false, status: request.status, error: `Authorization request is already ${request.status}.` };
            }
            if (!this._isCeoApprover(args.rejected_by, request.tenant_id || tenantId)) {
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

    async getOrCreateSession(identifier, context = {}) {
        // Determine lookup strategy: phone number (string) or email (object { email })
        const tenantId = this._getTenantIdFromContext(context) || this._getTenantIdFromContext(identifier);
        const normalizedTenantId = this._normalizeTenantId(tenantId);
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
        const sessionMapKey = this._buildSessionMapKey(normalizedTenantId, sessionKey);

        const existingSessionKey = this.sessions.has(sessionMapKey)
            ? sessionMapKey
            : (this.sessions.has(sessionKey) ? sessionKey : null);

        if (existingSessionKey) {
            const session = this.sessions.get(existingSessionKey);
            // Reset Timeout on activity
            clearTimeout(session.timeoutId);
            session.timeoutId = setTimeout(() => this.flushSession(sessionMapKey), this.SESSION_TIMEOUT_MS);
            session.tenantId = normalizedTenantId;
            session.sessionMapKey = sessionMapKey;
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
                    lookup = await crm.callTool('get_lead_by_phone', this._buildTenantContextArgs({ phone }, normalizedTenantId));
                } catch (err) {
                    console.error("[MasterAI] CRM Phone Lookup Failed:", err.message);
                }
            }

            if (lookup.status !== 'Found' && email) {
                try {
                    lookup = await crm.callTool('get_lead_by_email', this._buildTenantContextArgs({ email }, normalizedTenantId));
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
                        type_filter: 'SESSION',
                        ...this._buildTenantContextArgs({}, normalizedTenantId)
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
            sessionMapKey,
            tenantId: normalizedTenantId,
            leadId: leadId,
            leadContext: leadContext,
            recentSessions: recentSessions,
            messages: [],
            timeoutId: setTimeout(() => this.flushSession(sessionMapKey), this.SESSION_TIMEOUT_MS)
        };

        this.sessions.set(sessionKey, session);
        this.sessions.set(sessionMapKey, session);
        return session;
    }

    async flushSession(sessionKey) {
        const key = typeof sessionKey === 'string' && sessionKey.includes('::')
            ? sessionKey.split('::')[1]
            : sessionKey;
        const session = this.sessions.get(sessionKey) || this.sessions.get(key);
        if (!session) return;

        const tenantId = session.tenantId || this.defaultTenantId;
        this._emitSystemEvent('session.closed', session.leadId || key, {
            sessionKey: key,
            tenant_id: tenantId,
            messageCount: session.messages.length
        });

        console.log(`[MasterAI] Session Timeout for ${key}. Processing flush...`);

        if (session.messages.length > 0) {
            let analysis = null;
            try {
                const crm = this.subAgents.find(a => a.name === 'CRMAgent');
                analysis = await this._analyzeSnapshotSession(session);

                if (session.leadContext?.isTemporary && !analysis.is_business_relevant) {
                    console.log(`[MasterAI] Session dropped (not business-relevant): ${analysis.reason || 'LLM classified non-business conversation'}`);
                } else {
                    let leadId = session.leadId;
                    const phone = session.leadContext?.phone || key;

                    if (session.leadContext?.isTemporary) {
                        const created = await crm.callTool('add_lead', {
                            name: analysis.extracted_name || 'WhatsApp User',
                            primary_phone: phone,
                            source: analysis.source?.category
                                ? analysis.source
                                : { category: 'WhatsApp', detail: 'Auto-created after conversation' },
                            ...this._buildTenantContextArgs({}, tenantId)
                        });
                        leadId = created.lead_id || phone;
                    }

                    const snapshotPayload = {
                        lead_id: leadId,
                        ...this._buildTenantContextArgs({}, tenantId)
                    };
                    if (analysis.email) snapshotPayload.email = analysis.email;
                    if (analysis.source?.category || analysis.source?.detail) snapshotPayload.source = analysis.source;
                    if (Array.isArray(analysis.preferences) && analysis.preferences.length > 0) snapshotPayload.preferences = analysis.preferences;
                    if (analysis.ai_notes && Object.keys(analysis.ai_notes).length > 0) snapshotPayload.ai_notes = analysis.ai_notes;
                    if (analysis.profile_type) snapshotPayload.profile_type = analysis.profile_type;

                    const demographics = {};
                    if (analysis.unit_type_required) demographics.unit_type_required = analysis.unit_type_required;
                    if (analysis.budget) demographics.budget = analysis.budget;
                    if (analysis.move_in) demographics.move_in = analysis.move_in;
                    if (Object.keys(demographics).length > 0) snapshotPayload.demographics = demographics;

                    if (Object.keys(snapshotPayload).length > 2) {
                        await crm.callTool('update_lead_snapshot', snapshotPayload);
                    }

                    const relatedEventIds = [];
                    const sessionRecord = await crm.callTool('log_session', {
                        lead_id: leadId,
                        interaction_type: 'WhatsApp Conversation',
                        participants: [phone, 'MasterAI'],
                        summary: analysis.summary || `Session with ${session.messages.length} messages.`,
                        sentiment: analysis.sentiment || 'Neutral',
                        tone: analysis.tone || 'Neutral',
                        financial_impact: analysis.financial_impact || 'None',
                        compliance_impact: analysis.compliance_impact || 'None',
                        ...this._buildTenantContextArgs({}, tenantId),
                        links: { artifacts: [], related_event_ids: [] }
                    });

                    const mergeReview = await this._maybeCreateMergeReview({
                        crm,
                        leadId,
                        tenantId,
                        analysis,
                        sessionEventId: sessionRecord?.event_id || null
                    });
                    if (mergeReview?.event_id) {
                        relatedEventIds.push(mergeReview.event_id);
                    }

                    if (sessionRecord?.event_id && relatedEventIds.length > 0) {
                        const timelinePayload = await crm.callTool('get_timeline', this._buildTenantContextArgs({ lead_id: leadId, limit: 200 }, tenantId));
                        const timeline = Array.isArray(timelinePayload?.events) ? timelinePayload.events : [];
                        const sessionEvent = timeline.find((event) => event.event_id === sessionRecord.event_id);
                        if (sessionEvent) {
                            sessionEvent.links = {
                                ...(sessionEvent.links || {}),
                                related_event_ids: relatedEventIds
                            };
                        }
                    }

                    console.log(`[MasterAI] Snapshot process completed for ${leadId}.`);
                }
            } catch (err) {
                console.error(`[MasterAI] Failed to flush session:`, err.message);
                this._emitSystemEvent('flush.failed', key, {
                    phone: session.leadContext?.phone || key,
                    messages: session.messages,
                    error: err.message,
                    verdict: analysis
                });
            }
        } else {
            console.log(`[MasterAI] Empty or unlinked session. Dropped.`);
        }

        const flushSessionMapKey = session.sessionMapKey || this._buildSessionMapKey(tenantId, key);
        this.sessions.delete(flushSessionMapKey);
        this.sessions.delete(key);
    }

    async _analyzeSnapshotSession(session) {
        const snapshotPrompt = `Analyze this conversation and respond with ONLY valid JSON:
{
  "is_business_relevant": true,
  "reason": "one line explanation",
  "extracted_name": null,
  "summary": "2-3 line session summary",
  "sentiment": "Positive/Neutral/Negative",
  "tone": "Formal/Casual/Urgent/Practical",
  "financial_impact": "one line money implication or None",
  "compliance_impact": "one line compliance implication or None",
  "email": null,
  "source": { "category": null, "detail": null },
  "unit_type_required": null,
  "budget": null,
  "move_in": null,
  "preferences": [],
  "ai_notes": {},
  "merge_review": {
    "should_flag": false,
    "target_name": null,
    "target_email": null,
    "reasoning": null,
    "confidence": null,
    "relationship": "Duplicate"
  }
}

Rules:
- Business-relevant means PG/hostel/tenant/business operations context.
- Snapshot enrichment must extract only what is actually revealed by the session.
- Flag merge_review only if the conversation strongly suggests this person already exists in CRM under another identity or number.`;

        const completion = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: snapshotPrompt },
                ...session.messages.map((message) => ({ role: message.role, content: message.content }))
            ]
        });

        let parsed = {};
        try {
            parsed = JSON.parse(completion.choices[0].message.content);
        } catch (_err) {
            parsed = {};
        }

        return {
            is_business_relevant: parsed.is_business_relevant !== false,
            reason: parsed.reason || '',
            extracted_name: parsed.extracted_name || null,
            summary: parsed.summary || '',
            sentiment: parsed.sentiment || 'Neutral',
            tone: parsed.tone || 'Neutral',
            financial_impact: parsed.financial_impact || 'None',
            compliance_impact: parsed.compliance_impact || 'None',
            email: parsed.email || null,
            source: parsed.source || null,
            unit_type_required: parsed.unit_type_required || null,
            budget: parsed.budget || null,
            move_in: parsed.move_in || null,
            preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
            ai_notes: parsed.ai_notes && typeof parsed.ai_notes === 'object' ? parsed.ai_notes : {},
            profile_type: parsed.profile_type || null,
            merge_review: parsed.merge_review && typeof parsed.merge_review === 'object' ? parsed.merge_review : { should_flag: false }
        };
    }

    async _maybeCreateMergeReview({ crm, leadId, tenantId, analysis, sessionEventId }) {
        if (!analysis?.merge_review?.should_flag) return null;

        const targetHints = [analysis.merge_review.target_email, analysis.merge_review.target_name, analysis.extracted_name]
            .filter(Boolean);

        let targetLead = null;

        if (analysis.merge_review.target_email) {
            const byEmail = await crm.callTool('get_lead_by_email', this._buildTenantContextArgs({ email: analysis.merge_review.target_email }, tenantId));
            if (byEmail?.status === 'Found' && byEmail.lead?.lead_id !== leadId) {
                targetLead = byEmail.lead;
            }
        }

        if (!targetLead) {
            for (const hint of targetHints) {
                const matches = await crm.callTool('search_leads', this._buildTenantContextArgs({ query: hint, limit: 5, offset: 0 }, tenantId));
                const leads = Array.isArray(matches?.leads) ? matches.leads : [];
                targetLead = leads.find((lead) => lead.lead_id !== leadId) || null;
                if (targetLead) break;
            }
        }

        if (!targetLead) {
            const directLeads = crm?.leads && typeof crm.leads.values === 'function'
                ? Array.from(crm.leads.values())
                : [];
            const normalizedTargetEmail = String(analysis.merge_review.target_email || '').trim().toLowerCase();
            const normalizedTargetName = String(analysis.merge_review.target_name || '').trim().toLowerCase();

            targetLead = directLeads.find((lead) => {
                if (!lead || lead.lead_id === leadId) return false;
                const leadEmail = String(lead.email || '').trim().toLowerCase();
                const leadName = String(lead.name || '').trim().toLowerCase();
                if (normalizedTargetEmail && leadEmail === normalizedTargetEmail) return true;
                if (normalizedTargetName && leadName === normalizedTargetName) return true;
                return false;
            }) || null;
        }

        if (!targetLead) {
            const recent = await crm.callTool('get_recent_leads', this._buildTenantContextArgs({ limit: 100 }, tenantId));
            const leads = Array.isArray(recent?.leads) ? recent.leads : [];
            const normalizedTargetEmail = String(analysis.merge_review.target_email || '').trim().toLowerCase();
            const normalizedTargetName = String(analysis.merge_review.target_name || '').trim().toLowerCase();

            targetLead = leads.find((lead) => {
                if (!lead || lead.lead_id === leadId) return false;
                const leadEmail = String(lead.email || '').trim().toLowerCase();
                const leadName = String(lead.name || '').trim().toLowerCase();
                if (normalizedTargetEmail && leadEmail === normalizedTargetEmail) return true;
                if (normalizedTargetName && leadName === normalizedTargetName) return true;
                return false;
            }) || null;
        }

        if (!targetLead) return null;

        return crm.callTool('upsert_merge_review', this._buildTenantContextArgs({
            source_lead_id: leadId,
            target_lead_id: targetLead.lead_id,
            relationship: analysis.merge_review.relationship || 'Duplicate',
            reasoning: analysis.merge_review.reasoning || 'Snapshot process detected possible existing customer match.',
            confidence: analysis.merge_review.confidence || null,
            triggered_by_event_id: sessionEventId || null
        }, tenantId));
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
            const tenantId = this._getTenantIdFromContext(userContext);
            const runtimeConfig = this._getRuntimeConfig(tenantId);
            const runtimePersona = runtimeConfig?.persona || BusinessConfig.persona;
            const role = this._getConversationRole(userContext, runtimePersona);
            const isCEO = role === 'CEO';
            const isStaff = role === 'Staff';
            const isCustomer = role === 'Customer';
            const ownStaffMember = isStaff
                ? await this._resolveOwnStaffMember(userContext || {}, tenantId)
                : null;
            const ownCrmLead = !isCEO
                ? await this._resolveOwnCrmLead(userContext || {}, tenantId)
                : null;
            const identityContext = { role, ownStaffMember, ownCrmLead, tenantId };

            // Collect tools from all other agents
            const allTools = [];
            const agentMap = {};

            let agentIndex = 1;
            this.subAgents.forEach(agent => {
                const agentPrefix = isCEO ? agent.name : `SubAgent_${agentIndex}`;
                const visibleTools = this._getChatVisibleTools(agent, identityContext);

                visibleTools.forEach(tool => {
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

            const persona = runtimePersona;
            const publicPersona = {
                name: this.identity.personaName,
                role: this.identity.role
            };
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
                - You MAY share operational details: occupancy rates, pending maintenance, tenant status, collection summaries, task lists, CRM lead context, and read-only property visibility.
                - You MAY share schedules, pending approvals, and workflow statuses.
                - For HR, you may only access and reveal this staff member's own HR details. You must refuse requests for employee roster, other staff salaries, or any other employee's profile.
                - If the staff member asks for their own HR profile, salary, leaves, compensation, or incentives, you MUST use the available HR self tools and answer only from the retrieved record. Do not guess or infer HR details from persona text.
                - For CRM, you may use the operational CRM toolset across the tenant, including lead lookup and status/note updates, but you must avoid identity-destructive actions.
                - For Property, you may use read-only operational property tools only. You must refuse any property mutation request.
                - You must NOT reveal AI architecture, sub-agent names, tool prefixes, or system internals.
                - You must NOT share individual tenant financial details (specific amounts, payment history) unless the staff member's role requires it.
                - You must NOT reveal that you are an AI "Orchestrator" routing tasks to other AI models.
                - Act as ${publicPersona.name}, the ${publicPersona.role}. Treat this as a professional internal conversation.`;
                if (ownStaffMember?.id) {
                    systemPrompt += `\n- The matched HR identity for this user is staff_id=${ownStaffMember.id}, name=${ownStaffMember.name}, designation=${ownStaffMember.designation}, primary_phone=${ownStaffMember.contact?.primary || 'unknown'}.`;
                } else {
                    systemPrompt += `\n- No matched HR identity was found for this user. Refuse HR profile requests instead of guessing.`;
                }
            } else if (isCustomer) {
                systemPrompt += `\n\n**STRICT IDENTITY GUARDRAIL**: You are speaking to an external customer or prospective tenant.
                - Act as a unified, singular human representative named ${publicPersona.name}.
                - You MAY share: available room types, pricing (public rate card), amenities, location details, visit scheduling, their own booking status, their own payment dues, their own CRM status, and their own booking-linked property context.
                - For CRM, you may only access this user's own CRM profile and timeline.
                - For Property, you may only access public inventory/rate information and this user's own booking-linked property context.
                - If the user asks about their own CRM record, booking-linked property context, available units, property amenities, or public pricing, you MUST use the allowed CRM/Property tools and answer only from the retrieved data. Do not guess or claim absence without checking the tools first.
                - You must NOT share any HR information, employee roster data, salary information, or internal staff contact details.
                - You must NOT share: other tenants' information, internal staff details, occupancy numbers, business revenue, operational costs, or any internal metrics.
                - You must NOT mention internal tools, AI agents, tool prefixes (e.g., PropertyAI_, CRMAgent_), or system architecture.
                - You must NOT reveal that you are an AI "Orchestrator" routing tasks to other AI models.
                - Keep responses warm, helpful, and sales-oriented.`;
                if (ownCrmLead?.lead_id) {
                    systemPrompt += `\n- The matched CRM identity for this user is lead_id=${ownCrmLead.lead_id}, name=${ownCrmLead.name || 'unknown'}, profile_type=${ownCrmLead.profile_type || 'Customer'}.`;
                } else {
                    systemPrompt += `\n- No CRM identity was resolved. Refuse self-data requests that require internal lookup instead of guessing.`;
                }
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
                    const executionTenantId = this._normalizeTenantId(tenantId);

                    if (agentMap[fnName]) {
                        const { agent, toolName } = agentMap[fnName];
                        const scopedArgs = this._scopeChatToolArgs(
                            agent,
                            toolName,
                            this._buildTenantContextArgs(parsedArgs, executionTenantId),
                            identityContext
                        );
                        const args = this._injectImageUrlsIntoPropertyArgs(
                            agent,
                            toolName,
                            scopedArgs,
                            history
                        );
                        console.log(`[MasterAI] Iteration ${iteration}: Calling ${toolName} on ${agent.name}`);

                        let result;
                        try {
                            this._emitSystemEvent('tool.execution_start', null, { tool: toolName, agent: agent.name });
                            if (this._isFinanceMutationTool(agent.name, toolName)) {
                                result = await this._executeDeterministicFinanceWorkflow(toolName, args, 'chat', executionTenantId);
                            } else {
                                result = await agent.callTool(toolName, args);
                            }
                            result = this._sanitizeChatToolResult(agent, toolName, result, identityContext);
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
        if (event.event_type === 'staff.hired' || event.event_type === 'staff.profile_updated') {
            const tenantId = this._getTenantIdFromContext(event.context || event.payload || {});
            const result = await this._syncStaffProfileToCrm(event.payload || {}, tenantId);
            this._emitSystemEvent('staff.crm_sync.completed', null, {
                tenant_id: tenantId,
                staff_id: event?.payload?.staff_id || null,
                lead_id: result?.lead_id || null,
                mode: result?.mode || 'unknown',
                event_type: event.event_type,
            });
            return result;
        }

        if (event.event_type === 'message.received') {
            const from = event.payload?.from;
            const tenantId = this._getTenantIdFromContext(event.context || {});
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
            const session = await this.getOrCreateSession(from, { ...(event.context || {}), tenant_id: tenantId });

            this._emitSystemEvent('workflow.started', session.leadId || from, { source, from, tenant_id: tenantId || session.tenantId });

            // 2. Buffer User Message
            session.messages.push({ role: 'user', content: text, timestamp: TimeAuthorityService.nowIST() });

            // 3. Prepare Context for Brain (System + Memory)
            // Flatten session messages for LLM
            const history = session.messages.map(m => ({ role: m.role, content: m.content }));

            // 4. Autonomous Decision (Chat) - Pass the CRM Context as User Identity
            const response = await this.chat(history, { ...(session.leadContext || {}), tenant_id: tenantId || session.tenantId });

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

            this._emitSystemEvent('workflow.ended', session.leadId || from, { source, from, tenant_id: tenantId || session.tenantId });
        }
    }

    async executeSubagentTool(agentName, toolName, args) {
        // Find the agent
        const agent = this.subAgents.find(a => a.name === agentName);
        if (!agent) {
            throw new Error(`SubAgent '${agentName}' not found or not connected to MasterAI.`);
        }
        const tenantId = this._extractTenantFromArgs(args);

        try {
            this._emitSystemEvent('tool.execution_start', null, { tool: toolName, agent: agent.name, source: 'dashboard', tenant_id: tenantId });

            // Execute the tool
            const result = this._isFinanceMutationTool(agent.name, toolName)
                ? await this._executeDeterministicFinanceWorkflow(toolName, this._buildTenantContextArgs(args, tenantId), 'dashboard', tenantId)
                : await agent.callTool(toolName, this._buildTenantContextArgs(args, tenantId));

            this._emitSystemEvent('tool.execution_end', null, { tool: toolName, agent: agent.name, result, source: 'dashboard', tenant_id: tenantId });
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
