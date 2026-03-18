const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const OpenAI = require('openai');
const MasterAI = require('./agents/MasterAI');
const PropertyAI = require('./agents/PropertyAI');
const CRMAgent = require('./agents/CRMAgent');
const HRAgent = require('./agents/HRAgent');
const FinanceAI = require('./agents/FinanceAI');
const CommunicationsAI = require('./agents/CommunicationsAI');
const TimeAuthorityService = require('./services/TimeAuthorityService');
const PhoneNormalizationService = require('./services/PhoneNormalizationService');
const OtpChallengeService = require('./services/OtpChallengeService');
const CommunicationsEventBus = require('./services/CommunicationsEventBus');
const BusinessConfig = require('./config/business');
const WorkflowStore = require('./storage/WorkflowStore');
const ImageStore = require('./storage/ImageStore');
const WhatsAppSimulatorBus = require('./observability/WhatsAppSimulatorBus');
const {
    ensurePredefinedFinancialWorkflows,
    isProtectedPredefinedWorkflow
} = require('./workflows/financialWorkflowPolicy');
const {
    normalizeWorkflowDefinition,
    validateWorkflowDefinition,
    buildWorkflowClone,
    buildBlankWorkflowDraft,
    publishWorkflowVersion,
    archiveWorkflowVersion,
    discardWorkflowDraft,
    resolveEffectiveWorkflow,
    upgradeWorkflowCollection,
} = require('./workflows/workflowGovernance');
const { resolveFinanceButtonContracts } = require('./workflows/financeButtonContracts');
const { proposeSopAssistantReply } = require('./workflows/sopAssistant');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3101;
const APP_ENV = process.env.APP_ENV || 'development';
const IS_PROD = APP_ENV === 'production';
const ALLOW_DEBUG_ENDPOINTS = !IS_PROD && process.env.ALLOW_DEBUG_ENDPOINTS !== 'false';
const ALLOW_DEV_BYPASS_IN_PROD = process.env.ALLOW_DEV_BYPASS_IN_PROD === 'true';
const upload = multer({ storage: multer.memoryStorage() });
const googleTokenCache = new Map();

// Startup Check
try {
    require('fs').writeFileSync('startup.txt', 'Fresh Run Server Started at ' + TimeAuthorityService.nowIST());

    // Redirect Console to File
    const fs = require('fs');
    const util = require('util');
    const logFile = fs.createWriteStream('server.log', { flags: 'a' });
    const logStdout = process.stdout;
    console.log = function () {
        logFile.write(util.format.apply(null, arguments) + '\n');
        logStdout.write(util.format.apply(null, arguments) + '\n');
    }
    console.error = function () {
        logFile.write(util.format.apply(null, arguments) + '\n');
        logStdout.write(util.format.apply(null, arguments) + '\n');
    }

    console.log('Startup Check: File written successfully.');
} catch (e) {
    console.error('Startup Check Failed:', e);
}

const corsOptions = IS_PROD && process.env.CORS_ORIGIN
    ? { origin: process.env.CORS_ORIGIN }
    : {};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
    const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
});
app.use((req, _res, next) => {
    req.tenantId = normalizeTenantIdFromRequest(req);
    next();
});

const fs = require('fs');
const IMAGE_STORAGE_ROOT = process.env.K_SERVICE
    ? path.join(__dirname, '..')
    : path.join(__dirname, '..', '..');
const IMAGE_DIR = process.env.IMAGE_DIR || path.join(IMAGE_STORAGE_ROOT, 'images');
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'local';
const MIN_IMAGE_BYTES = 1024;
const workflowStore = MasterAI.getWorkflowStore();
const imageStore = new ImageStore({
    backend: STORAGE_BACKEND,
    imageDir: IMAGE_DIR,
    publicBaseUrl: process.env.BACKEND_PUBLIC_BASE_URL || '',
});
const artifactExtractionClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (STORAGE_BACKEND === 'local') {
    app.use('/images', express.static(IMAGE_DIR));
}

const ADMIN_ADAPTER_POLICY = {
    CRMAgent: new Set([
        'add_lead',
        'get_dashboard_stats',
        'get_merge_candidates',
        'get_recent_leads',
        'search_leads',
        'get_lead',
        'get_lead_by_phone',
        'get_lead_by_email',
        'get_timeline',
        'get_leads_by_status',
        'get_lead_artifacts',
        'update_lead_snapshot',
        'add_secondary_phone',
        'add_manual_note',
        'change_status',
        'link_artifact',
        'merge_leads',
        'archive_lead',
        'set_primary_phone',
    ]),
    PropertyAI: new Set([
        'add_property',
        'update_property',
        'delete_property',
        'get_properties',
        'add_unit',
        'update_unit',
        'delete_unit',
        'get_units',
        'assign_tenant',
        'vacate_tenant',
        'set_notice',
        'get_public_rate_card',
        'get_property_metrics',
    ]),
    CommunicationsAI: new Set([
        'send_whatsapp_message',
        'send_text_message',
        'send_media_message',
        'send_template_message',
        'get_whatsapp_conversation_window',
        'send_location_message',
        'send_contact_message',
        'send_interactive_message',
        'check_contact_status',
        'mark_message_as_read',
        'get_business_profile',
        'update_business_profile',
        'download_media',
    ]),
    HRAgent: new Set([
        'hire_staff',
        'update_staff_profile',
        'terminate_staff',
        'get_staff_details',
        'get_all_staff',
        'create_salary_card',
        'update_salary_card',
        'get_salary_card',
        'record_leave',
        'get_staff_leaves',
        'approve_leave_request',
        'calculate_incentive',
        'get_performance_metrics',
    ]),
    FinanceAI: new Set([
        'record_booking_hold',
        'get_booking_holds',
        'expire_booking_hold',
        'complete_onboarding_from_booking',
        'record_incoming_txn',
        'get_incoming_txns',
        'get_txn_details',
        'record_outgoing_txn',
        'record_correction_txn',
        'get_expenses',
        'get_work_orders',
        'get_ledger',
        'add_ledger_entry',
        'generate_monthly_bills',
        'onboard_tenant_contract',
        'process_salary_payout',
        'get_financial_summary',
        'get_defaulters_list',
        'get_unit_collection_status',
        'get_assigned_unit_collection_statuses',
        'add_vendor',
        'get_vendors',
        'get_vendor_summary',
    ]),
};

const ADMIN_ROLE_PERMISSIONS = {
    CEO: {
        CRMAgent: new Set(Array.from(ADMIN_ADAPTER_POLICY.CRMAgent)),
        PropertyAI: new Set(Array.from(ADMIN_ADAPTER_POLICY.PropertyAI)),
        CommunicationsAI: new Set(Array.from(ADMIN_ADAPTER_POLICY.CommunicationsAI)),
        HRAgent: new Set(Array.from(ADMIN_ADAPTER_POLICY.HRAgent)),
        FinanceAI: new Set(Array.from(ADMIN_ADAPTER_POLICY.FinanceAI)),
    },
    Staff: {
        CRMAgent: new Set([
            'get_dashboard_stats',
            'get_merge_candidates',
            'get_recent_leads',
            'search_leads',
            'get_lead',
            'get_lead_by_phone',
            'get_lead_by_email',
            'get_timeline',
            'get_leads_by_status',
            'get_lead_artifacts',
            'update_lead_snapshot',
            'add_secondary_phone',
            'add_manual_note',
            'change_status',
            'link_artifact',
        ]),
        PropertyAI: new Set([
            'get_properties',
            'get_units',
            'get_public_rate_card',
            'get_property_metrics',
        ]),
        HRAgent: new Set([
            'get_salary_card',
            'get_staff_details',
            'get_all_staff',
            'get_staff_leaves',
            'calculate_incentive',
            'get_performance_metrics',
            'record_leave',
            'approve_leave_request',
        ]),
        FinanceAI: new Set([
            'record_incoming_txn',
            'record_outgoing_txn',
            'get_unit_collection_status',
            'get_assigned_unit_collection_statuses',
            'get_work_orders',
        ]),
        CommunicationsAI: new Set([
            'send_whatsapp_message',
            'send_text_message',
            'send_media_message',
            'send_template_message',
            'send_location_message',
            'send_contact_message',
            'send_interactive_message',
            'check_contact_status',
            'mark_message_as_read',
            'get_business_profile',
        ]),
    },
    Customer: {
        CRMAgent: new Set([
            'get_lead',
            'get_lead_by_phone',
            'get_lead_by_email',
            'get_timeline',
            'get_lead_artifacts',
        ]),
        PropertyAI: new Set([]),
        HRAgent: new Set([]),
        FinanceAI: new Set([
            'get_ledger',
            'get_incoming_txns',
            'get_txn_details',
        ]),
        CommunicationsAI: new Set([
            'send_whatsapp_message',
            'send_text_message',
            'check_contact_status',
        ]),
    },
};

function getDevRequesterEmail(req) {
    const headerEmail = req.headers['x-actor-email'] || req.headers['x-admin-email'];
    if (!headerEmail || typeof headerEmail !== 'string') return null;
    const email = headerEmail.trim().toLowerCase();
    if (!email) return null;
    if (!IS_PROD) return email;
    // Production bypass is opt-in and disabled by default.
    return ALLOW_DEV_BYPASS_IN_PROD ? email : null;
}

function normalizeTenantIdFromRequest(req) {
    const actorEmail = String(req?.headers?.['x-actor-email'] || req?.headers?.['x-admin-email'] || '').trim().toLowerCase();
    const headerTenant = req?.headers?.['x-tenant-id'] || req?.headers?.['x-business-id'];
    const queryTenant = req?.query?.tenant_id;
    const bodyTenant = req?.body?.tenant_id;
    const actorTenant = actorEmail ? findTenantIdByCeoEmail(actorEmail) || null : null;
    const normalizedCandidate = String(headerTenant || queryTenant || bodyTenant || '').trim();
    const rawTenantId = (normalizedCandidate && normalizedCandidate !== 'default')
        ? normalizedCandidate
        : (actorTenant || (req?.authUser?.tenant_id));

    const normalized = typeof rawTenantId === 'string' ? rawTenantId.trim() : '';
    return normalized || (BusinessConfig.DEFAULT_TENANT_ID || 'default');
}

function findTenantIdByCeoEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;
    const tenants = BusinessConfig.getAllTenantConfigs();
    for (const [tenantId, config] of Object.entries(tenants)) {
        const ceoEmail = String(config?.persona?.ceo_email || '').trim().toLowerCase();
        if (ceoEmail && ceoEmail === normalizedEmail) {
            return tenantId;
        }
    }
    return null;
}

function findTenantIdByCeoPhone(phone) {
    let normalizedPhone = null;
    try {
        normalizedPhone = PhoneNormalizationService.normalizeToE164(phone);
    } catch (_error) {
        return null;
    }
    const tenants = BusinessConfig.getAllTenantConfigs();
    for (const [tenantId, config] of Object.entries(tenants)) {
        const ceoPhone = String(config?.persona?.ceo_phone || '').trim();
        if (ceoPhone && ceoPhone === normalizedPhone) {
            return tenantId;
        }
    }
    return null;
}

function isCeoPhoneVerificationRequired(tenantConfig = {}, profileType = 'Customer') {
    if (profileType !== 'CEO') return false;
    return !String(tenantConfig?.persona?.ceo_phone || '').trim();
}

function getTenantAccountStatus(tenantConfig = {}, profileType = 'Customer') {
    if (isCeoPhoneVerificationRequired(tenantConfig, profileType)) {
        return 'PENDING_CEO_PHONE_VERIFICATION';
    }
    return tenantConfig?.account_status || 'ACTIVE';
}

function deriveTenantIdFromEmail(email) {
    const raw = String(email || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return raw || BusinessConfig.DEFAULT_TENANT_ID;
}

function getUniqueTenantId(baseTenantId) {
    const all = BusinessConfig.getAllTenantConfigs();
    if (!all[baseTenantId]) return baseTenantId;
    let idx = 2;
    while (all[`${baseTenantId}_${idx}`]) idx += 1;
    return `${baseTenantId}_${idx}`;
}

function deriveBusinessName(displayName, email) {
    if (displayName) return `${displayName}'s Workspace`;
    const fallback = String(email || '').split('@')[0] || 'Business';
    return `${fallback}'s Workspace`;
}

function buildHrCompensationCatalog(tenantConfig = {}) {
    const finance = tenantConfig?.finance || {};
    const templates = finance.staff_compensation_templates || {};
    const caretakerTemplate = templates.caretaker || {
        base_salary: Number(finance.caretaker_compensation?.fixed_basic_salary) || Number(finance.default_base_salary) || 4000,
        components: {
            incentives: {
                logic: 'Fully paid occupied units * amount per unit',
                amount_per_unit: Number(finance.caretaker_compensation?.per_fully_paid_occupied_unit) || 0,
            },
            allowances: {
                travel: 0,
                phone: 0,
            },
            caretaker_rules: {
                daily_cleaning_proof_amount: Number(finance.caretaker_compensation?.daily_cleaning_proof_amount) || 0,
                weekly_parking_cleaning_amount: Number(finance.caretaker_compensation?.weekly_parking_cleaning_amount) || 0,
                maintenance_complaint_deduction: Number(finance.caretaker_compensation?.maintenance_complaint_deduction) || 0,
            },
        },
    };

    return {
        designation_options: [
            { value: 'Caretaker', label: 'Caretaker', default_profile_key: 'caretaker' },
        ],
        profile_options: [
            {
                key: 'caretaker',
                label: 'Caretaker Standard',
                summary: 'Fixed salary plus unit and proof-based caretaker rules.',
                template: caretakerTemplate,
            },
        ],
    };
}

async function resolveAuthContext(req) {
    const tenantId = normalizeTenantIdFromRequest(req);
    const trustedEmail = (req.authUser?.email || getDevRequesterEmail(req) || '').trim().toLowerCase();
    const tenantConfig = BusinessConfig.getBusinessConfig(tenantId);
    const ceoEmail = String(tenantConfig?.persona?.ceo_email || '').trim().toLowerCase();
    let profileType = 'Customer';
    let crmLead = null;

    if (trustedEmail && trustedEmail === ceoEmail) {
        profileType = 'CEO';
        try {
            const lookup = await crmAgent.callTool('get_lead_by_email', { email: trustedEmail, tenant_id: tenantId });
            if (lookup?.status === 'Found' && lookup.lead) {
                crmLead = lookup.lead;
            }
        } catch (_err) {
            // Fail closed to config-owned CEO role.
        }
    } else if (trustedEmail) {
        try {
            const lookup = await crmAgent.callTool('get_lead_by_email', { email: trustedEmail, tenant_id: tenantId });
            if (lookup?.status === 'Found' && lookup.lead) {
                crmLead = lookup.lead;
                profileType = lookup.lead.profile_type || 'Customer';
            }
        } catch (_err) {
            // Fail closed to default profile type.
        }
    }

    const normalizedProfile = ['CEO', 'Staff', 'Customer'].includes(profileType) ? profileType : 'Customer';
    const permissions = ADMIN_ROLE_PERMISSIONS[normalizedProfile] || ADMIN_ROLE_PERMISSIONS.Customer;
    const requiresCeoPhoneVerification = isCeoPhoneVerificationRequired(tenantConfig, normalizedProfile);
    const accountStatus = getTenantAccountStatus(tenantConfig, normalizedProfile);

    return {
        tenant_id: tenantId,
        email: trustedEmail || null,
        profile_type: normalizedProfile,
        crm_lead_id: crmLead?.lead_id || null,
        account_status: accountStatus,
        requires_ceo_phone_verification: requiresCeoPhoneVerification,
        business_name: tenantConfig?.business_name || null,
        owner: {
            name: tenantConfig?.persona?.name || 'Workspace Owner',
            email: ceoEmail || null,
            phone: tenantConfig?.persona?.ceo_phone || null,
            role: tenantConfig?.persona?.role || 'CEO',
            phone_verified_at: tenantConfig?.persona?.ceo_phone_verified_at || null,
        },
        hr_compensation_catalog: buildHrCompensationCatalog(tenantConfig),
        permissions: {
            admin_adapter: Object.fromEntries(
                Object.entries(permissions).map(([agent, tools]) => [agent, Array.from(tools)])
            ),
        },
    };
}

async function resolveOwnStaffRecord(authContext, tenantId) {
    if (authContext?.profile_type !== 'Staff' || !authContext?.email) {
        return null;
    }
    try {
        const staffRows = await hrAgent.callTool('get_all_staff', { tenant_id: tenantId });
        if (!Array.isArray(staffRows)) return null;
        const email = String(authContext.email || '').trim().toLowerCase();
        return staffRows.find((staff) => String(staff?.contact?.email || '').trim().toLowerCase() === email) || null;
    } catch (_error) {
        return null;
    }
}

function ensureActivatedAccount(authContext, res) {
    if (authContext?.requires_ceo_phone_verification) {
        res.status(403).json({
            success: false,
            error: 'Complete CEO phone verification before using the workspace.',
            code: 'CEO_PHONE_VERIFICATION_REQUIRED',
        });
        return false;
    }
    return true;
}

function ensureCeoWorkflowAccess(authContext, res) {
    if (authContext?.profile_type !== 'CEO') {
        res.status(403).json({ success: false, error: 'Only CEO can manage SOP drafts, publish, archive, or discard them.' });
        return false;
    }
    return true;
}

function listTenantVisibleWorkflows(tenantId) {
    return workflowStore
        .listForTenant(tenantId)
        .filter((workflow) => !workflow?.ui_hidden);
}

function serializeWorkflowForTenant(workflow, tenantId) {
    const workflows = workflowStore.list();
    const effective = resolveEffectiveWorkflow(workflows, workflow.workflow_family, tenantId);
    const isTenantWorkflow = workflow.tenant_id === tenantId;
    const isSystemTemplate = workflow.version_type === 'system_template' || (!workflow.tenant_id && workflow.protected);
    const effectiveForTenant = effective?.workflow_id === workflow.workflow_id;
    let business_state = 'Draft';

    if (workflow.version_type === 'archived_snapshot') {
        business_state = 'Archived';
    } else if (workflow.version_type === 'tenant_draft') {
        business_state = 'Draft';
    } else if (effectiveForTenant) {
        business_state = 'Active';
    } else if (workflow.version_type === 'tenant_published') {
        business_state = 'Archived';
    }

    return {
        ...workflow,
        effective_for_tenant: effectiveForTenant,
        business_state,
        visible_in_sop_list: !isSystemTemplate || effectiveForTenant,
        template_state: isSystemTemplate ? (effectiveForTenant ? 'ACTIVE_DEFAULT' : 'OVERRIDDEN_BY_TENANT') : null,
        tenant_state: isTenantWorkflow
            ? (workflow.version_type === 'tenant_published'
                ? 'PUBLISHED'
                : workflow.version_type === 'archived_snapshot'
                    ? 'ARCHIVED'
                    : 'DRAFT')
            : null,
    };
}

function validateAdminAdapterPolicy(agentName, toolName, parameters = {}, authContext = null) {
    const policy = ADMIN_ADAPTER_POLICY[agentName];
    if (policy && !policy.has(toolName)) {
        return {
            ok: false,
            status: 403,
            error: `Admin adapter policy blocks ${agentName}.${toolName}. Route this through approved workflow/authorization path.`,
        };
    }

    const profileType = authContext?.profile_type || 'Customer';
    const rolePermissions = ADMIN_ROLE_PERMISSIONS[profileType] || ADMIN_ROLE_PERMISSIONS.Customer;
    const allowedForRole = rolePermissions[agentName];
    if (allowedForRole && !allowedForRole.has(toolName)) {
        return {
            ok: false,
            status: 403,
            error: `${profileType} role is not permitted to execute ${agentName}.${toolName}.`,
        };
    }

    if (agentName === 'CRMAgent' && toolName === 'change_status' && !String(parameters.reason || '').trim()) {
        return {
            ok: false,
            status: 400,
            error: 'change_status requires a non-empty reason.',
        };
    }

    return { ok: true };
}

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        app: 'PG-BusinessFlow.ai',
        env: APP_ENV,
        timestamp: TimeAuthorityService.nowIST()
    });
});

app.get('/ready', (_req, res) => {
    const missing = [];
    const required = ['OPENAI_API_KEY'];
    if (IS_PROD) {
        required.push('WEBHOOK_VERIFY_TOKEN');
        required.push('WHATSAPP_PHONE_NUMBER_ID');
    }
    if (STORAGE_BACKEND === 'gcp') {
        required.push('GCS_BUCKET_NAME');
        required.push('BACKEND_PUBLIC_BASE_URL');
    }
    if (CommunicationsEventBus.isPubSubEnabled()) {
        required.push('PUBSUB_COMMUNICATIONS_TOPIC');
        required.push('PUBSUB_PUSH_AUDIENCE');
        required.push('PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL');
    }
    required.forEach((k) => {
        if (!process.env[k]) missing.push(k);
    });
    if (missing.length > 0) {
        return res.status(503).json({ status: 'not_ready', missing });
    }
    return res.json({ status: 'ready', env: APP_ENV });
});

app.get('/api/auth/context', requireAuth, async (req, res) => {
    try {
        const context = await resolveAuthContext(req);
        context.tenant_id = req.tenantId || context.tenant_id;
        return res.json({ success: true, data: context });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/bootstrap', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const intent = ['signin', 'signup'].includes(body.intent) ? body.intent : 'signin';
        const trustedEmail = String(req.authUser?.email || getDevRequesterEmail(req) || body.email || '').trim().toLowerCase();
        const displayName = String(req.authUser?.name || body.name || '').trim();
        if (!trustedEmail) {
            return res.status(400).json({ success: false, error: 'Missing authenticated email for bootstrap.' });
        }

        const existingTenantId = findTenantIdByCeoEmail(trustedEmail);
        let targetTenantId = existingTenantId || null;
        let created = false;

        if (intent === 'signin' && !existingTenantId) {
            return res.status(404).json({
                success: false,
                error: 'Account not found. Please use Sign Up first to create your CEO workspace.',
            });
        }

        if (!targetTenantId) {
            const baseTenantId = deriveTenantIdFromEmail(trustedEmail);
            targetTenantId = getUniqueTenantId(baseTenantId);
            created = true;
        }

        const existingConfig = BusinessConfig.getBusinessConfig(targetTenantId);
        const updatedConfig = BusinessConfig.saveTenantConfig(targetTenantId, {
            business_name: deriveBusinessName(displayName, trustedEmail),
            account_status: created
                ? 'PENDING_CEO_PHONE_VERIFICATION'
                : getTenantAccountStatus(existingConfig, 'CEO'),
            persona: {
                name: displayName || String(trustedEmail.split('@')[0] || 'CEO'),
                role: 'CEO',
                ceo_email: trustedEmail,
                ceo_phone: created ? null : (existingConfig?.persona?.ceo_phone || null),
            },
        });

        const authReq = {
            ...req,
            tenantId: targetTenantId,
            authUser: {
                ...(req.authUser || {}),
                email: trustedEmail,
                name: displayName || req.authUser?.name || trustedEmail,
            },
        };
        const context = await resolveAuthContext(authReq);
        return res.json({
            success: true,
            data: {
                intent,
                created,
                tenant_id: targetTenantId,
                business_name: updatedConfig?.business_name || null,
                profile_type: context.profile_type,
                account_status: context.account_status,
                requires_ceo_phone_verification: context.requires_ceo_phone_verification,
                email: context.email,
                name: updatedConfig?.persona?.name || displayName || null,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/ceo-phone/start', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (authContext.profile_type !== 'CEO') {
            return res.status(403).json({ success: false, error: 'Only the CEO can verify the owner phone.' });
        }
        if (!authContext.requires_ceo_phone_verification) {
            return res.status(409).json({ success: false, error: 'CEO phone is already verified for this workspace.' });
        }

        const rawPhone = String(req.body?.phone || '').trim();
        if (!rawPhone) {
            return res.status(400).json({ success: false, error: 'Phone number is required.' });
        }

        let normalizedPhone;
        try {
            normalizedPhone = PhoneNormalizationService.normalizeToE164(rawPhone);
        } catch (_error) {
            return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
        }

        const existingTenantByPhone = findTenantIdByCeoPhone(normalizedPhone);
        if (existingTenantByPhone && existingTenantByPhone !== authContext.tenant_id) {
            return res.status(409).json({ success: false, error: 'This phone number is already bound to another workspace owner.' });
        }

        const challenge = OtpChallengeService.createChallenge({
            scope: authContext.tenant_id,
            actor: authContext.email,
            payload: {
                phone: normalizedPhone,
                tenant_id: authContext.tenant_id,
                email: authContext.email,
            },
        });

        await dispatchCeoOtpChallenge({
            phone: normalizedPhone,
            code: challenge.code,
            createdAt: challenge.created_at,
        });

        return res.json({
            success: true,
            data: {
                phone: normalizedPhone,
                expires_at: challenge.expires_at,
                delivery_channel: IS_PROD && process.env.ALLOW_EXTERNAL_SEND === 'true' ? 'whatsapp_template' : 'whatsapp_simulator',
                dev_otp: !IS_PROD ? challenge.code : undefined,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/ceo-phone/verify', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (authContext.profile_type !== 'CEO') {
            return res.status(403).json({ success: false, error: 'Only the CEO can complete owner phone verification.' });
        }
        if (!authContext.requires_ceo_phone_verification) {
            return res.status(409).json({ success: false, error: 'CEO phone is already verified for this workspace.' });
        }

        const otp = String(req.body?.otp || '').trim();
        if (!otp) {
            return res.status(400).json({ success: false, error: 'OTP is required.' });
        }

        const verification = OtpChallengeService.verifyChallenge({
            scope: authContext.tenant_id,
            actor: authContext.email,
            code: otp,
        });
        if (!verification.ok) {
            return res.status(400).json({ success: false, error: verification.error });
        }

        const verifiedPhone = verification.payload?.phone;
        const existingConfig = BusinessConfig.getBusinessConfig(authContext.tenant_id);
        const updatedConfig = BusinessConfig.saveTenantConfig(authContext.tenant_id, {
            account_status: 'ACTIVE',
            persona: {
                ...(existingConfig?.persona || {}),
                ceo_email: authContext.email,
                ceo_phone: verifiedPhone,
                ceo_phone_verified_at: TimeAuthorityService.nowIST(),
            },
        });

        await upsertTenantCeoCrmProfile(authContext.tenant_id, {
            name: updatedConfig?.persona?.name || 'Workspace Owner',
            email: authContext.email,
            phone: verifiedPhone,
        });

        const refreshedContext = await resolveAuthContext({
            headers: {
                ...(req.headers || {}),
                'x-tenant-id': authContext.tenant_id,
                'x-actor-email': authContext.email,
            },
            query: req.query || {},
            body: req.body || {},
            authUser: req.authUser || null,
            tenantId: authContext.tenant_id,
        });

        return res.json({
            success: true,
            data: {
                tenant_id: authContext.tenant_id,
                phone: verifiedPhone,
                profile_type: refreshedContext.profile_type,
                account_status: refreshedContext.account_status,
                requires_ceo_phone_verification: refreshedContext.requires_ceo_phone_verification,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

async function verifyGoogleToken(idToken) {
    const cached = googleTokenCache.get(idToken);
    if (cached && cached.exp > Date.now()) return cached.payload;

    const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { id_token: idToken },
        timeout: 5000
    });
    const payload = response.data;
    if (!payload || payload.email_verified !== 'true') {
        throw new Error('Unverified Google identity');
    }
    const allowedClientIds = new Set(
        String(process.env.GOOGLE_AUTH_ALLOWED_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
    );
    if (allowedClientIds.size > 0 && !allowedClientIds.has(String(payload.aud || '').trim())) {
        throw new Error('Unexpected Google OAuth client');
    }
    const expMs = (Number(payload.exp || 0) * 1000) || (Date.now() + 300000);
    googleTokenCache.set(idToken, { payload, exp: expMs });
    return payload;
}

async function requireAuth(req, res, next) {
    if (!IS_PROD) return next();
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) {
            const bypassEmail = getDevRequesterEmail(req);
            if (bypassEmail) {
                req.authUser = {
                    email: bypassEmail,
                    name: 'Dev Bypass User',
                    picture: null,
                    type: 'Bypass'
                };
                return next();
            }
            return res.status(401).json({ success: false, error: 'Missing bearer token' });
        }
        const payload = await verifyGoogleToken(token);

        const authMode = (process.env.GOOGLE_AUTH_MODE || 'internal').toLowerCase();
        const allowedDomain = process.env.GOOGLE_AUTH_ALLOWED_DOMAIN;
        const allowedEmailsRaw = process.env.GOOGLE_AUTH_ALLOWED_EMAILS || '';
        const allowedEmails = new Set(
            allowedEmailsRaw
                .split(',')
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean)
        );
        const email = String(payload.email || '').toLowerCase();
        const emailDomain = email.includes('@') ? email.split('@')[1] : '';
        const hasInternalRules = Boolean(allowedDomain) || allowedEmails.size > 0;

        if (authMode === 'internal') {
            if (!hasInternalRules) {
                return res.status(503).json({
                    success: false,
                    error: 'GOOGLE_AUTH_MODE=internal requires GOOGLE_AUTH_ALLOWED_DOMAIN or GOOGLE_AUTH_ALLOWED_EMAILS'
                });
            }
            const domainAllowed = allowedDomain ? emailDomain === String(allowedDomain).toLowerCase() : false;
            const emailAllowed = allowedEmails.size > 0 ? allowedEmails.has(email) : false;
            if (!domainAllowed && !emailAllowed) {
                return res.status(403).json({ success: false, error: 'Authenticated user is not authorized for internal mode' });
            }
        } else if (authMode !== 'public') {
            return res.status(503).json({ success: false, error: 'Invalid GOOGLE_AUTH_MODE. Use internal or public' });
        }

        req.authUser = {
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture || null,
            type: 'Google'
        };
        return next();
    } catch (_err) {
        return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }
}

function requireDebugAccess(req, res, next) {
    if (!ALLOW_DEBUG_ENDPOINTS) {
        return res.status(403).json({ success: false, error: 'Debug endpoints are disabled in production mode' });
    }
    return next();
}

function normalizeExtractedReference(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const match = source.match(/[A-Z0-9-]{6,}/i);
    return match ? String(match[0]).toUpperCase() : '';
}

async function extractArtifactReference(files = []) {
    if (!artifactExtractionClient) return '';
    const imageFiles = files.filter((file) => file?.mimetype?.startsWith('image/') && file.size >= MIN_IMAGE_BYTES).slice(0, 4);
    if (imageFiles.length === 0) return '';
    try {
        const response = await artifactExtractionClient.responses.create({
            model: process.env.OPENAI_ARTIFACT_EXTRACTION_MODEL || 'gpt-4.1-mini',
            input: [{
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: 'These are payment proof images. Extract the single most likely payment transaction reference / UTR / reference ID if clearly visible. Return only the reference text. If none is visible, return an empty string.'
                    },
                    ...imageFiles.map((file) => ({
                        type: 'input_image',
                        image_url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    })),
                ],
            }],
        });
        return normalizeExtractedReference(response?.output_text || '');
    } catch (error) {
        console.warn('[ArtifactUpload] Reference extraction failed:', error?.message || error);
        return '';
    }
}

app.get('/api/storage/file', async (req, res) => {
    if (STORAGE_BACKEND !== 'gcp') {
        return res.status(404).json({ success: false, error: 'GCP storage file proxy is disabled.' });
    }
    try {
        const objectPath = String(req.query?.path || '').trim();
        if (!objectPath) {
            return res.status(400).json({ success: false, error: 'path query param is required' });
        }
        const file = await imageStore.readFile(objectPath);
        if (!file) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Cache-Control', file.cacheControl);
        return res.send(file.buffer);
    } catch (error) {
        console.error('Storage File Proxy Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Image upload endpoint — saves files to storage and returns accessible URLs
app.post('/api/upload/images', requireAuth, upload.array('images', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files provided' });
        }
        const urls = [];
        const skipped = [];
        for (const f of req.files) {
            if (!f.mimetype.startsWith('image/')) {
                skipped.push({ name: f.originalname, reason: 'non-image' });
                continue;
            }
            if (f.size < MIN_IMAGE_BYTES) {
                skipped.push({ name: f.originalname, reason: 'too-small' });
                continue;
            }
            urls.push(await imageStore.saveBuffer(f.buffer, f.originalname, 'prop'));
        }
        res.json({ success: true, data: { urls, skipped } });
    } catch (error) {
        console.error('Image Upload Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/upload/artifacts', requireAuth, upload.array('artifacts', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files provided' });
        }
        const urls = [];
        const skipped = [];
        for (const file of req.files) {
            if (!file?.buffer?.length) {
                skipped.push({ name: file?.originalname || 'unknown', reason: 'empty-file' });
                continue;
            }
            urls.push(await imageStore.saveBuffer(file.buffer, file.originalname, 'artifact'));
        }
        const extractedReference = await extractArtifactReference(req.files);
        res.json({ success: true, data: { urls, skipped, extracted_reference: extractedReference } });
    } catch (error) {
        console.error('Artifact Upload Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Initialize Agents during startup after storage is hydrated.
let propertyAI = null;
let crmAgent = null;
let hrAgent = null;
let financeAI = null;
let commsAI = null;
let masterAI = null;
let allAgents = [];

async function dispatchCeoOtpChallenge({ phone, code, createdAt }) {
    const templateName = String(process.env.WHATSAPP_CEO_OTP_TEMPLATE_NAME || 'otp_en').trim();
    const languageCode = String(process.env.WHATSAPP_CEO_OTP_TEMPLATE_LANGUAGE || 'en_US').trim();

    if (!IS_PROD || process.env.ALLOW_EXTERNAL_SEND !== 'true') {
        WhatsAppSimulatorBus.recordOutbound({
            to: phone,
            text: { body: `Your PG Business Portal CEO verification OTP is ${code}. It expires in 10 minutes.` },
        }, { simulated: true, data: { id: createdAt } });
        return { status: 'success', simulated: true };
    }

    const result = await commsAI.callTool('send_template_message', {
        recipient_phone: phone,
        template_name: templateName,
        language_code: languageCode,
        components: [
            {
                type: 'body',
                parameters: [
                    {
                        type: 'text',
                        text: String(code),
                    },
                ],
            },
            {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                    {
                        type: 'text',
                        text: String(code),
                    },
                ],
            },
        ],
    });

    if (result?.status !== 'success') {
        const rawError = result?.error;
        const providerMessage = rawError?.error?.error_data?.details
            || rawError?.error?.message
            || rawError?.message
            || (typeof rawError === 'string' ? rawError : null);
        throw new Error(providerMessage || 'Unable to dispatch CEO OTP template.');
    }

    return result;
}

async function upsertTenantCeoCrmProfile(tenantId, owner = {}) {
    const normalizedTenantId = normalizeTenantIdFromRequest({ headers: { 'x-tenant-id': tenantId } });
    const email = String(owner?.email || '').trim().toLowerCase();
    const name = String(owner?.name || 'Workspace Owner').trim();
    const phone = String(owner?.phone || '').trim();
    if (!email || !phone) {
        return null;
    }

    let lookup = null;
    const byPhone = await crmAgent.callTool('get_lead_by_phone', { tenant_id: normalizedTenantId, phone });
    if (byPhone?.status === 'Found' && byPhone.lead) {
        lookup = byPhone.lead;
    }

    if (!lookup) {
        const byEmail = await crmAgent.callTool('get_lead_by_email', { tenant_id: normalizedTenantId, email });
        if (byEmail?.status === 'Found' && byEmail.lead) {
            lookup = byEmail.lead;
        }
    }

    if (lookup) {
        await crmAgent.callTool('update_lead_snapshot', {
            tenant_id: normalizedTenantId,
            lead_id: lookup.lead_id,
            name,
            email,
            profile_type: 'CEO',
        });
        const knownPhones = new Set([
            lookup.lead_id,
            lookup.phones?.primary?.number,
            ...((lookup.phones?.others || []).map((entry) => entry?.number)),
        ].filter(Boolean));
        if (!knownPhones.has(phone)) {
            await crmAgent.callTool('add_secondary_phone', {
                tenant_id: normalizedTenantId,
                lead_id: lookup.lead_id,
                phone_number: phone,
                label: 'CEO Contact',
            });
        }
        return lookup.lead_id;
    }

    const created = await crmAgent.callTool('add_lead', {
        tenant_id: normalizedTenantId,
        name,
        primary_phone: phone,
        email,
        profile_type: 'CEO',
        source: { category: 'System', detail: 'ceo.verified' },
    });
    return created?.lead_id || phone;
}

async function syncExistingTenantOwnerProfilesToCrm() {
    const allTenants = BusinessConfig.getAllTenantConfigs();
    for (const [tenantId, config] of Object.entries(allTenants)) {
        if (getTenantAccountStatus(config, 'CEO') === 'PENDING_CEO_PHONE_VERIFICATION') continue;
        const phone = String(config?.persona?.ceo_phone || '').trim();
        const email = String(config?.persona?.ceo_email || '').trim().toLowerCase();
        if (!phone || !email) continue;
        try {
            await upsertTenantCeoCrmProfile(tenantId, {
                name: config?.persona?.name || 'Workspace Owner',
                phone,
                email,
            });
        } catch (error) {
            console.warn(`[Owner CRM Sync] ${tenantId} failed: ${error.message}`);
        }
    }
}

async function resolveTenantIdByPhone(phone) {
    let normalizedPhone = null;
    try {
        normalizedPhone = PhoneNormalizationService.normalizeToE164(phone);
    } catch (_error) {
        return null;
    }

    const allTenants = BusinessConfig.getAllTenantConfigs();
    for (const tenantId of Object.keys(allTenants)) {
        try {
            const lookup = await crmAgent.callTool('get_lead_by_phone', { tenant_id: tenantId, phone: normalizedPhone });
            if (lookup?.status === 'Found' && lookup.lead) {
                return tenantId;
            }
        } catch (_error) {
            // Continue scanning tenants.
        }
    }

    return findTenantIdByCeoPhone(normalizedPhone);
}

async function seedSystemDemoData() {
    const explicitSeed = process.env.SEED_DEMO_DATA;
    const shouldSeed = explicitSeed === 'true'
        || (!IS_PROD && STORAGE_BACKEND === 'local' && explicitSeed !== 'false');
    if (!shouldSeed) return;
    if (crmAgent.leads.size > 0 || propertyAI.properties.length > 0 || hrAgent.staff.length > 0 || financeAI.transactions.length > 0) {
        return;
    }

    const safeCall = async (agent, tool, parameters) => {
        try {
            return await agent.callTool(tool, parameters);
        } catch (error) {
            console.warn(`[Demo Seed] ${agent.name}.${tool} failed: ${error.message}`);
            return null;
        }
    };

    const allImageFiles = fs.readdirSync(IMAGE_DIR)
        .filter((name) => /\.(jpg|jpeg|png)$/i.test(name))
        .sort();
    const propertyImageFiles = allImageFiles.filter((name) => name.startsWith('prop_'));
    const fallbackImageFiles = allImageFiles.filter((name) => !name.startsWith('prop_'));
    const seedImages = (propertyImageFiles.length > 0 ? propertyImageFiles : fallbackImageFiles).map((name) => `/images/${name}`);
    const property1Images = seedImages.slice(0, 5);
    const property2Images = seedImages.slice(5, 10).length > 0 ? seedImages.slice(5, 10) : seedImages.slice(0, 3);
    const leadArtifactImages = seedImages.slice(0, 3);

    const ensureCrmProfile = async ({ name, phone, email, profile_type = 'Customer', status = 'Enquiry', source = { category: 'Demo', detail: 'System Seed' } }) => {
        const existing = await safeCall(crmAgent, 'get_lead_by_phone', { phone });
        if (existing?.status === 'Found' && existing.lead) {
            await safeCall(crmAgent, 'update_lead_snapshot', {
                lead_id: existing.lead.lead_id,
                email: email || undefined,
                profile_type
            });
            return existing.lead.lead_id;
        }

        const created = await safeCall(crmAgent, 'add_lead', {
            name,
            primary_phone: phone,
            email,
            profile_type,
            source
        });
        const leadId = created?.lead_id || phone;

        if (status !== 'Enquiry') {
            if (status === 'Visited' || status === 'Onboarded' || status === 'Left') {
                await safeCall(crmAgent, 'change_status', {
                    lead_id: leadId,
                    to_status: 'Visited',
                    reason: 'Demo seed status setup'
                });
            }
            if (status === 'Onboarded' || status === 'Left') {
                await safeCall(crmAgent, 'change_status', {
                    lead_id: leadId,
                    to_status: 'Onboarded',
                    reason: 'Demo seed status setup'
                });
            }
            if (status === 'Left') {
                await safeCall(crmAgent, 'change_status', {
                    lead_id: leadId,
                    to_status: 'Left',
                    reason: 'Demo seed status setup'
                });
            }
        }
        return leadId;
    };

    // HR staff and salary setup.
    const staffRecords = [
        { name: 'Ramesh Kumar', designation: 'Property Manager', phone: '+919833334444', email: 'ramesh@pgflow.ai', salary: 4000 },
        { name: 'Meera Joshi', designation: 'Sales Executive', phone: '+919844445555', email: 'meera@pgflow.ai', salary: 3500 },
        { name: 'Arun Singh', designation: 'Maintenance Supervisor', phone: '+919855556666', email: 'arun@pgflow.ai', salary: 3800 }
    ];

    for (const staff of staffRecords) {
        const hired = await safeCall(hrAgent, 'hire_staff', {
            name: staff.name,
            designation: staff.designation,
            contact: {
                primary: staff.phone,
                email: staff.email
            },
            base_salary: staff.salary
        });
        const staffId = hired?.staff_id;
        if (!staffId) continue;

        await safeCall(hrAgent, 'create_salary_card', {
            staff_id: staffId,
            base_salary: staff.salary,
            bank_details: {
                account_holder: staff.name,
                account_number: `000${staffId.replace('STF-', '')}123456`,
                ifsc: 'HDFC0001234',
                bank_name: 'HDFC Bank',
                upi_id: `${staff.name.split(' ')[0].toLowerCase()}@hdfcbank`
            },
            components: {
                incentives: { logic: 'Units Occupied * Amount Per Unit', amount_per_unit: 350 },
                allowances: { travel: 1000, phone: 500 }
            }
        });

        await ensureCrmProfile({
            name: staff.name,
            phone: staff.phone,
            email: staff.email,
            profile_type: 'Staff',
            status: 'Enquiry'
        });
    }

    // CRM customer setup.
    const customerLeadA = await ensureCrmProfile({
        name: 'Amit Sharma',
        phone: '+919800098000',
        email: 'amit@demo.pgflow.ai',
        profile_type: 'Customer',
        status: 'Onboarded'
    });
    const customerLeadB = await ensureCrmProfile({
        name: 'Neha Gupta',
        phone: '+919811112222',
        email: 'neha@demo.pgflow.ai',
        profile_type: 'Customer',
        status: 'Visited'
    });
    const customerLeadC = await ensureCrmProfile({
        name: 'Rohit Verma',
        phone: '+919822223333',
        email: 'rohit@demo.pgflow.ai',
        profile_type: 'Customer',
        status: 'Enquiry'
    });

    for (const leadId of [customerLeadA, customerLeadB, customerLeadC]) {
        await safeCall(crmAgent, 'log_session', {
            lead_id: leadId,
            summary: 'Customer requested room details and pricing.',
            sentiment: 'Neutral',
            tone: 'Professional',
            links: {
                artifacts: leadArtifactImages
            }
        });
    }
    await safeCall(crmAgent, 'add_manual_note', {
        lead_id: customerLeadA,
        content: 'Customer prefers double sharing close to office.',
        author: 'demo_seed'
    });
    if (leadArtifactImages[0]) {
        await safeCall(crmAgent, 'link_artifact', {
            lead_id: customerLeadA,
            file_url: leadArtifactImages[0],
            file_type: 'Image',
            description: 'Room preference sample image'
        });
    }
    if (leadArtifactImages[1]) {
        await safeCall(crmAgent, 'link_artifact', {
            lead_id: customerLeadB,
            file_url: leadArtifactImages[1],
            file_type: 'Image',
            description: 'Visit reference image'
        });
    }

    // Property and tenancy setup.
    await safeCall(propertyAI, 'add_property', {
        name: 'Sunrise Residency',
        address: '12 Lake View Road, Pune',
        pin_code: '411014',
        area: 'Viman Nagar',
        city: 'Pune',
        state: 'Maharashtra',
        description: 'Primary occupied property for demo operations.',
        floors: 3,
        amenities: ['WiFi', 'Parking', 'CCTV', 'RO Water'],
        image_urls: property1Images,
        thumbnail_url: property1Images[0] || ''
    });
    await safeCall(propertyAI, 'add_property', {
        name: 'Maple Heights',
        address: '88 Hill Street, Pune',
        pin_code: '411001',
        area: 'Camp',
        city: 'Pune',
        state: 'Maharashtra',
        description: 'Secondary property for demo leads.',
        floors: 2,
        amenities: ['WiFi', 'Power Backup'],
        image_urls: property2Images,
        thumbnail_url: property2Images[0] || ''
    });

    await safeCall(propertyAI, 'add_unit', {
        property_id: 'PROP-1',
        unit_number: '101',
        floor: 1,
        types: ['Double Sharing'],
        base_rent: 12000,
        rate_card: {
            base_rent: 12000,
            security_deposit: 2500,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
            maintenance_fee: 0
        },
        amenities: ['WiFi', 'Parking']
    });
    await safeCall(propertyAI, 'add_unit', {
        property_id: 'PROP-1',
        unit_number: '102',
        floor: 1,
        types: ['Single Sharing'],
        base_rent: 14000,
        rate_card: {
            base_rent: 14000,
            security_deposit: 3000,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
            maintenance_fee: 0
        },
        amenities: ['WiFi']
    });
    await safeCall(propertyAI, 'add_unit', {
        property_id: 'PROP-2',
        unit_number: '201',
        floor: 2,
        types: ['Double Sharing'],
        base_rent: 11500,
        rate_card: {
            base_rent: 11500,
            security_deposit: 2500,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
            maintenance_fee: 0
        },
        amenities: ['WiFi']
    });

    await safeCall(propertyAI, 'assign_tenant', {
        unit_id: 'UNIT-1',
        lead_id: customerLeadA,
        start_date: '2026-03-01',
        monthly_rent: 12000,
        security_deposit: 2500
    });
    await safeCall(propertyAI, 'assign_tenant', {
        unit_id: 'UNIT-3',
        lead_id: customerLeadB,
        start_date: '2026-03-02',
        monthly_rent: 11500,
        security_deposit: 2500
    });

    await safeCall(propertyAI, 'add_meter', {
        consumer_number: 'EL-1001',
        linked_units: ['UNIT-1'],
        initial_reading: 420
    });
    await safeCall(propertyAI, 'update_meter_reading', {
        meter_id: 'METER-1',
        reading: 448,
        date: '2026-03-03'
    });
    await safeCall(propertyAI, 'log_maintenance_req', {
        property_id: 'PROP-1',
        unit_id: 'UNIT-1',
        category: 'PLUMBING',
        description: 'Washroom tap leakage in Unit 101',
        priority: 'HIGH',
        reported_by: 'STF-03',
        reported_by_name: 'Shankar Patil',
        resident_name: 'Amit Sharma',
        image_urls: leadArtifactImages
    });

    // Finance setup.
    await safeCall(financeAI, 'onboard_tenant_contract', {
        lead_id: customerLeadA,
        negotiated_rent: 12000,
        security_deposit: 2500,
        rent_payment_timing: 'ADVANCE',
        utility_payment_timing: 'ARREARS',
        effective_from: '2026-03-01'
    });
    await safeCall(financeAI, 'onboard_tenant_contract', {
        lead_id: customerLeadB,
        negotiated_rent: 11500,
        security_deposit: 2500,
        rent_payment_timing: 'ADVANCE',
        utility_payment_timing: 'ARREARS',
        effective_from: '2026-03-01'
    });

    await safeCall(financeAI, 'add_ledger_entry', {
        payer_id: customerLeadA,
        category: 'Rent',
        amount_due: 12000,
        month_year: 'Mar 2026',
        reason: 'Monthly rent'
    });
    await safeCall(financeAI, 'add_ledger_entry', {
        payer_id: customerLeadB,
        category: 'Rent',
        amount_due: 11500,
        month_year: 'Mar 2026',
        reason: 'Monthly rent'
    });

    await safeCall(financeAI, 'record_incoming_txn', {
        payer_id: customerLeadA,
        amount: 15000,
        payment_mode: 'UPI',
        date: '2026-03-01',
        txn_id: 'IN-240301-001'
    });
    await safeCall(financeAI, 'record_incoming_txn', {
        payer_id: customerLeadB,
        amount: 12000,
        payment_mode: 'Bank Transfer',
        date: '2026-03-02',
        txn_id: 'IN-240302-002'
    });
    await safeCall(financeAI, 'record_outgoing_txn', {
        category: 'OpEx',
        sub_category: 'Plumbing',
        work_done: 'Pipe replacement in Block A',
        property_id: 'PROP-1',
        amount: 2500,
        payee: 'Ravi Plumbing Works',
        payment_mode: 'UPI',
        approved_by: 'demo_seed'
    });
    await safeCall(financeAI, 'record_outgoing_txn', {
        category: 'CapEx',
        sub_category: 'Furniture',
        work_done: 'New cots for Unit 102',
        property_id: 'PROP-1',
        amount: 9800,
        payee: 'Urban Furnishers',
        payment_mode: 'Bank Transfer',
        approved_by: 'demo_seed'
    });

    console.log('[Demo Seed] System demo data initialized.');
}

// SSE Event Clients
let sseClients = [];
let recentEvents = [];

function attachSystemEventListeners() {
    if (!masterAI) return;
    masterAI.on('system_event', (event) => {
        recentEvents.push(event);
        if (recentEvents.length > 50) recentEvents.shift();

        sseClients.forEach(client => {
            client.res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
    });
}

// Periodic heartbeat to keep connections alive
setInterval(() => {
    sseClients.forEach(client => {
        client.res.write(`event: ping\ndata: {"time": "${TimeAuthorityService.nowIST()}"}\n\n`);
    });
}, 20000);

// Routes

// 0. System Event Stream (SSE)
app.get('/api/system/events/stream', requireDebugAccess, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send an initial connection event
    res.write(`data: ${JSON.stringify({ event_type: 'stream.connected', timestamp: TimeAuthorityService.nowIST() })}\n\n`);

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    console.log(`[SSE] Client connected: ${clientId} (${sseClients.length} total)`);

    req.on('close', () => {
        console.log(`[SSE] Client disconnected: ${clientId}`);
        sseClients = sseClients.filter(client => client.id !== clientId);
    });
});

// 1. Get Agent Status (for Developer View)
app.get('/api/agents', requireDebugAccess, (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json({ success: true, data: { agents: statuses } });
});
app.get('/api/system/agents', requireDebugAccess, (req, res) => {
    const statuses = allAgents.map(a => a.getStatus());
    res.json({ success: true, data: { agents: statuses } });
});

// 2. Chat with Master AI
const chatHandler = async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) {
            return;
        }
        // Handle FormData fields that were stringified on the frontend
        let message = req.body.message;
        let messages = req.body.messages;
        let user = req.body.user;

        console.log('[ChatHandler] req.files:', req.files ? req.files.length + ' file(s)' : 'none');
        console.log('[ChatHandler] body keys:', Object.keys(req.body));

        if (typeof messages === 'string') messages = JSON.parse(messages);
        if (typeof user === 'string') user = JSON.parse(user);
        if (IS_PROD && req.authUser) user = req.authUser;

        let inputMessages = messages;
        if (message && !messages) {
            inputMessages = [{ role: 'user', content: message }];
        }

        let uploadedImageUrls = [];

        // Handle uploaded files — save to disk and inject accessible URLs
        if (req.files && req.files.length > 0 && inputMessages && inputMessages.length > 0) {
            const savedUrls = [];

            for (const f of req.files) {
                console.log('[ChatHandler] File received:', f.fieldname, f.originalname, f.mimetype, f.size + ' bytes');
                if (!f.mimetype.startsWith('image/')) continue;
                if (f.size < MIN_IMAGE_BYTES) {
                    console.warn('[ChatHandler] Skipping tiny image upload:', f.originalname, f.size + ' bytes');
                    continue;
                }
                // Save to disk (Phase 1: local file storage per implementation_plan.md)
                const savedUrl = await imageStore.saveBuffer(f.buffer, f.originalname, 'chat_upload');
                savedUrls.push(savedUrl);
            }

            // Append image URLs directly to the user's message text so the LLM can't miss them
            if (savedUrls.length > 0) {
                uploadedImageUrls = savedUrls;
                console.log('[ChatHandler] Saved URLs:', savedUrls);
                const lastMsg = inputMessages[inputMessages.length - 1];
                const urlList = savedUrls.join(', ');
                const imageNote = `\n\n[Attached ${savedUrls.length} image(s) — use these as image_urls: ${urlList}]`;
                if (typeof lastMsg.content === 'string') {
                    lastMsg.content += imageNote;
                } else if (Array.isArray(lastMsg.content)) {
                    // Find the text part and append
                    const textPart = lastMsg.content.find(p => p.type === 'text');
                    if (textPart) textPart.text += imageNote;
                    else lastMsg.content.push({ type: 'text', text: imageNote });
                }
                console.log('[ChatHandler] Last message content after injection:', typeof lastMsg.content === 'string' ? lastMsg.content.substring(0, 500) : 'array');
            }
        }

        if (!inputMessages) return res.status(400).json({ error: "No messages provided" });

        const normalizedEvent = await commsAI.callTool('handle_portal_message', {
            messages: inputMessages,
            user,
            correlation_id: req.correlationId,
            tenant_id: req.tenantId
        });

        const response = await masterAI.chat(
            normalizedEvent.payload?.history || inputMessages,
            { ...(normalizedEvent.context?.user || user || {}), tenant_id: req.tenantId }
        );
        res.json({ success: true, data: response, uploaded_image_urls: uploadedImageUrls });
    } catch (error) {
        console.error("Chat Handler Error:", error);
        res.status(500).json({ error: error.message });
    }
};

app.post('/api/communications/chat', requireAuth, upload.any(), chatHandler);

// 2.1 Get MasterAI Events
app.get('/api/master_ai/events', requireAuth, (req, res) => {
    resolveAuthContext(req).then((authContext) => {
        if (!ensureActivatedAccount(authContext, res)) return;
        res.json({ success: true, data: { events: [...recentEvents].reverse().slice(0, req.query.limit || 20) } });
    }).catch((error) => {
        res.status(500).json({ success: false, error: error.message });
    });
});

// 2.2 Get MasterAI Trace
app.get('/api/master_ai/trace/:id', requireAuth, (req, res) => {
    resolveAuthContext(req).then((authContext) => {
        if (!ensureActivatedAccount(authContext, res)) return;
        // Return a mock trace since we don't persist them locally
        res.json({
            success: true,
            data: {
                plan: "Execution Plan Generated",
                sub_tasks: [
                    { agent: "PropertyAI", instruction: "Analyzed request for properties", status: "completed" }
                ]
            }
        });
    }).catch((error) => {
        res.status(500).json({ success: false, error: error.message });
    });
});

// 2.3 Agent Control API
app.post('/api/system/agent/control', requireAuth, requireDebugAccess, (req, res) => {
    try {
        const { agent_name, action } = req.body;

        if (!agent_name || !action) {
            return res.status(400).json({ success: false, error: 'Missing agent_name or action' });
        }

        const agent = allAgents.find(a => a.name === agent_name);

        if (!agent) {
            return res.status(404).json({ success: false, error: `Agent ${agent_name} not found` });
        }

        switch (action) {
            case 'enable':
                if (typeof agent.enable === 'function') {
                    agent.enable();
                } else {
                    agent.status = 'online';
                }
                console.log(`[Agent Control] Enabled ${agent_name}, status is now ${agent.status}`);
                break;
            case 'disable':
                if (typeof agent.disable === 'function') {
                    agent.disable();
                } else {
                    agent.status = 'offline';
                }
                console.log(`[Agent Control] Disabled ${agent_name}, status is now ${agent.status}`);
                break;
            case 'restart':
                if (typeof agent.restart === 'function') {
                    agent.restart();
                } else {
                    agent.status = 'offline';
                    setTimeout(() => { agent.status = 'online'; }, 1000);
                }
                console.log(`[Agent Control] Restarted ${agent_name}, status will change shortly`);
                break;
            default:
                return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
        }

        res.json({ success: true, status: agent.status || 'unknown' });
    } catch (error) {
        console.error('Agent Control Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.4 Property API Route (Direct Tool Access) - LEGACY (To be deprecated)
app.post('/api/property/tools/:tool_name', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) {
            return;
        }
        const toolName = req.params.tool_name;
        // Verify tool exists in propertyAI
        if (!propertyAI.capabilities.tools.includes(toolName)) {
            return res.status(404).json({ success: false, error: `Tool ${toolName} not found or not allowed` });
        }
        const result = await propertyAI.callTool(toolName, { ...(req.body || {}), tenant_id: req.tenantId });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error(`Property Tool Error [${req.params.tool_name}]:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.4.1 Master AI - Execute SubAgent Tool (New Architectural Standard)
app.post('/api/master_ai/tools/execute', requireAuth, async (req, res) => {
    try {
        const { agent_name, tool_name, parameters } = req.body;

        if (!agent_name || !tool_name) {
            return res.status(400).json({ success: false, error: 'agent_name and tool_name are required.' });
        }

        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) {
            return;
        }
        const policyCheck = validateAdminAdapterPolicy(agent_name, tool_name, parameters || {}, authContext);
        if (!policyCheck.ok) {
            return res.status(policyCheck.status).json({ success: false, error: policyCheck.error });
        }

        console.log(`[API] Dashboard requested MasterAI to execute ${agent_name}.${tool_name}`);
        const enrichedParameters = {
            ...parameters,
            tenant_id: req.tenantId || parameters?.tenant_id,
            requested_by: authContext.email || req.authUser?.email || null,
            requested_by_role: authContext.profile_type || 'Customer',
        };

        if (authContext.profile_type === 'Staff' && agent_name === 'FinanceAI' && ['get_unit_collection_status', 'get_assigned_unit_collection_statuses'].includes(tool_name)) {
            const ownStaffRecord = await resolveOwnStaffRecord(authContext, req.tenantId || parameters?.tenant_id);
            if (!ownStaffRecord?.id) {
                return res.status(403).json({ success: false, error: 'Staff finance scope could not be resolved.' });
            }
            enrichedParameters.staff_id = ownStaffRecord.id;
        }

        if (authContext.profile_type === 'Customer' && agent_name === 'FinanceAI' && authContext.crm_lead_id && ['get_ledger', 'get_incoming_txns', 'get_txn_details'].includes(tool_name)) {
            enrichedParameters.payer_id = authContext.crm_lead_id;
        }

        const isCeo = authContext.profile_type === 'CEO' && authContext.email;
        if (isCeo && enrichedParameters) {
            enrichedParameters.ceo_authorized = true;
            enrichedParameters.approved_by = authContext.email;
        }

        const result = await masterAI.executeSubagentTool(agent_name, tool_name, enrichedParameters);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error(`[API] MasterAI Tool Execution Error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── 2.5 Workflow Definitions CRUD ───────────────────────────────────
// GET /api/workflows — list all visible SOP versions for the tenant
app.get('/api/workflows', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) {
            return;
        }
        const workflows = listTenantVisibleWorkflows(req.tenantId)
            .map((workflow) => serializeWorkflowForTenant(workflow, authContext.tenant_id || req.tenantId))
            .filter((workflow) => workflow.visible_in_sop_list);
        res.json({ success: true, data: { workflows } });
    } catch (error) {
        console.error('Workflow List Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/workflows/:id — get single version
app.get('/api/workflows/:id', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) {
            return;
        }
        const wf = workflowStore.getById(req.params.id);
        if (!wf) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        if (wf.tenant_id && wf.tenant_id !== (authContext.tenant_id || req.tenantId)) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        res.json({ success: true, data: serializeWorkflowForTenant(wf, authContext.tenant_id || req.tenantId) });
    } catch (error) {
        console.error('Workflow Get Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/workflows — create a blank draft or clone a draft from an existing version
app.post('/api/workflows', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;

        const tenantId = authContext.tenant_id || req.tenantId;
        const { clone_from_workflow_id, ...payload } = req.body || {};
        const workflows = workflowStore.list();

        if (clone_from_workflow_id) {
            const source = workflows.find((workflow) => workflow.workflow_id === clone_from_workflow_id);
            if (!source) {
                return res.status(404).json({ success: false, error: `Workflow '${clone_from_workflow_id}' not found` });
            }

            const existingDraft = workflows.find((workflow) => (
                workflow.tenant_id === tenantId
                && workflow.workflow_family === source.workflow_family
                && workflow.version_type === 'tenant_draft'
            ));
            if (existingDraft) {
                return res.status(200).json({ success: true, data: serializeWorkflowForTenant(existingDraft, tenantId) });
            }

            const clone = buildWorkflowClone(source, { tenant_id: tenantId });
            const mergedClone = normalizeWorkflowDefinition({
                ...clone,
                ...payload,
                tenant_id: tenantId,
                version_type: 'tenant_draft',
            }, {
                existingWorkflows: workflows,
                allowIncomplete: true,
            });
            workflows.push(mergedClone);
            workflowStore.saveAll(workflows);
            return res.status(201).json({ success: true, data: serializeWorkflowForTenant(mergedClone, tenantId) });
        }

        const family = String(payload.workflow_family || payload.family || payload.workflow_id || `sop_${Date.now()}`).trim();
        const blankDraft = buildBlankWorkflowDraft({
            tenant_id: tenantId,
            workflow_family: family,
            workflow_id: payload.workflow_id,
            name: payload.name || payload.title || '',
            domain: payload.domain || null,
            module_owner: payload.module_owner || payload.domain || null,
        });
        const normalizedDraft = normalizeWorkflowDefinition({
            ...blankDraft,
            ...payload,
            tenant_id: tenantId,
            version_type: 'tenant_draft',
        }, {
            existingWorkflows: workflows,
            allowIncomplete: true,
        });
        workflows.push(normalizedDraft);
        workflowStore.saveAll(workflows);

        console.log(`[Workflows] Draft created: ${normalizedDraft.workflow_id}`);
        res.status(201).json({ success: true, data: serializeWorkflowForTenant(normalizedDraft, tenantId) });
    } catch (error) {
        console.error('Workflow Create Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/workflows/:id — update an existing tenant draft
app.put('/api/workflows/:id', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;

        const tenantId = authContext.tenant_id || req.tenantId;
        const workflows = workflowStore.list();
        const idx = workflows.findIndex((workflow) => workflow.workflow_id === req.params.id);

        if (idx === -1) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        if (workflows[idx].tenant_id && workflows[idx].tenant_id !== tenantId) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        if (workflows[idx].version_type !== 'tenant_draft') {
            return res.status(403).json({
                success: false,
                error: 'Only tenant drafts can be edited directly. Create or reopen a draft first.',
            });
        }

        const normalizedWorkflow = normalizeWorkflowDefinition({
            ...workflows[idx],
            ...req.body,
            tenant_id: tenantId,
            version_type: 'tenant_draft',
        }, {
            existingWorkflow: workflows[idx],
            existingWorkflows: workflows,
            allowIncomplete: true,
        });
        workflows[idx] = normalizedWorkflow;

        workflowStore.saveAll(workflows);
        console.log(`[Workflows] Draft updated: ${req.params.id}`);
        res.json({ success: true, data: serializeWorkflowForTenant(workflows[idx], tenantId) });
    } catch (error) {
        console.error('Workflow Update Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/workflows/:id — discard draft only
app.delete('/api/workflows/:id', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;

        const tenantId = authContext.tenant_id || req.tenantId;
        const result = discardWorkflowDraft(workflowStore.list(), req.params.id, tenantId);
        workflowStore.saveAll(result.workflows);
        console.log(`[Workflows] Draft discarded: ${req.params.id}`);
        res.json({ success: true, data: result.workflow });
    } catch (error) {
        console.error('Workflow Delete Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 3. Verify OpenAI (Test Endpoint)
app.get('/api/verify-openai', requireAuth, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ status: 'error', message: 'Missing OPENAI_API_KEY' });
    }
    try {
        // Simple ping
        const result = await masterAI.chat([{ role: "user", content: "Ping. Are you active?" }]);
        res.json({ status: 'success', response: result.content });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/api/workflows/:id/validate', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;
        const tenantId = authContext.tenant_id || req.tenantId;
        const workflows = workflowStore.list();
        const idx = workflows.findIndex((workflow) => workflow.workflow_id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        if (workflows[idx].tenant_id && workflows[idx].tenant_id !== tenantId) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        if (workflows[idx].version_type !== 'tenant_draft') {
            return res.status(400).json({ success: false, error: 'Only tenant drafts can be validated.' });
        }

        const validation = validateWorkflowDefinition(workflows[idx], {
            existingWorkflows: upgradeWorkflowCollection(workflows.filter((workflow) => workflow.workflow_id !== req.params.id)),
            isUpdate: true,
            existingWorkflowId: req.params.id,
            mode: 'publish',
        });
        workflows[idx] = normalizeWorkflowDefinition({
            ...workflows[idx],
            validation_status: validation.ok ? 'validated' : 'needs_correction',
        }, {
            existingWorkflow: workflows[idx],
            existingWorkflows: workflows,
            allowIncomplete: true,
        });
        workflowStore.saveAll(workflows);

        res.json({
            success: true,
            data: {
                workflow: serializeWorkflowForTenant(workflows[idx], tenantId),
                validation,
            },
        });
    } catch (error) {
        console.error('Workflow Validate Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows/:id/publish', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;
        const tenantId = authContext.tenant_id || req.tenantId;
        const result = publishWorkflowVersion(workflowStore.list(), req.params.id, tenantId);
        workflowStore.saveAll(result.workflows);
        res.json({ success: true, data: serializeWorkflowForTenant(result.workflow, tenantId) });
    } catch (error) {
        console.error('Workflow Publish Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows/:id/archive', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;
        const tenantId = authContext.tenant_id || req.tenantId;
        const result = archiveWorkflowVersion(workflowStore.list(), req.params.id, tenantId);
        workflowStore.saveAll(result.workflows);
        res.json({ success: true, data: serializeWorkflowForTenant(result.workflow, tenantId) });
    } catch (error) {
        console.error('Workflow Archive Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows/:id/chat', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;

        const tenantId = authContext.tenant_id || req.tenantId;
        const workflow = workflowStore.getById(req.params.id);
        if (!workflow) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        if (workflow.tenant_id && workflow.tenant_id !== tenantId) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }

        const message = String(req.body?.message || '').trim();
        const assistantContext = await masterAI.buildSopAssistantContext(workflow, {
            tenant_id: tenantId,
            profile_type: authContext.profile_type || 'Customer',
            email: authContext.email || null,
            channel: 'sop_workspace',
        });
        const result = proposeSopAssistantReply(workflow, message, {
            tenant_id: tenantId,
            actor_role: authContext.profile_type || 'Customer',
            actor_email: authContext.email || null,
            system_context: assistantContext,
        });

        res.json({
            success: true,
            data: {
                reply: result.assistant_message,
                proposal: result.proposal,
                workflow: serializeWorkflowForTenant(workflow, tenantId),
            },
        });
    } catch (error) {
        console.error('Workflow Chat Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Compatibility wrappers for old surfaces during transition
app.post('/api/workflows/:id/activate', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;
        const tenantId = authContext.tenant_id || req.tenantId;
        const result = publishWorkflowVersion(workflowStore.list(), req.params.id, tenantId);
        workflowStore.saveAll(result.workflows);
        res.json({ success: true, data: serializeWorkflowForTenant(result.workflow, tenantId) });
    } catch (error) {
        console.error('Workflow Activate Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows/:id/deactivate', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;
        const tenantId = authContext.tenant_id || req.tenantId;
        const result = archiveWorkflowVersion(workflowStore.list(), req.params.id, tenantId);
        workflowStore.saveAll(result.workflows);
        res.json({ success: true, data: serializeWorkflowForTenant(result.workflow, tenantId) });
    } catch (error) {
        console.error('Workflow Deactivate Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows/:id/clone', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (!ensureCeoWorkflowAccess(authContext, res)) return;

        const tenantId = authContext.tenant_id || req.tenantId;
        const workflows = workflowStore.list();
        const source = workflows.find((workflow) => workflow.workflow_id === req.params.id);
        if (!source) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        const existingDraft = workflows.find((workflow) => (
            workflow.tenant_id === tenantId
            && workflow.workflow_family === source.workflow_family
            && workflow.version_type === 'tenant_draft'
        ));
        if (existingDraft) {
            return res.status(200).json({ success: true, data: serializeWorkflowForTenant(existingDraft, tenantId) });
        }

        const clone = buildWorkflowClone(source, { tenant_id: tenantId });
        workflows.push(clone);
        workflowStore.saveAll(workflows);
        res.status(201).json({ success: true, data: serializeWorkflowForTenant(clone, tenantId) });
    } catch (error) {
        console.error('Workflow Clone Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/finance/button-contracts', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        const tenantId = authContext.tenant_id || req.tenantId;
        const financeToolSchemas = Object.fromEntries(
            (financeAI.getTools() || []).map((tool) => [tool.name, tool.input_schema || {}])
        );
        const contracts = resolveFinanceButtonContracts(workflowStore.list(), tenantId, financeToolSchemas);
        res.json({
            success: true,
            data: {
                buttons: contracts,
                generated_at: TimeAuthorityService.nowIST(),
            },
        });
    } catch (error) {
        console.error('Finance Button Contracts Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/finance/approvals', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        const result = await masterAI.callTool('list_pending_financial_workflow_requests', {
            tenant_id: authContext.tenant_id || req.tenantId,
        });
        if (!result.success) {
            return res.status(400).json(result);
        }

        const pending = Array.isArray(result.pending) ? result.pending : [];
        const scopedPending = authContext.profile_type === 'CEO'
            ? pending
            : pending.filter((request) => String(request.requested_by || '').toLowerCase() === String(authContext.email || '').toLowerCase());

        res.json({ success: true, data: { pending: scopedPending } });
    } catch (error) {
        console.error('Finance Approval List Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/finance/approvals/:id/approve', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (authContext.profile_type !== 'CEO') {
            return res.status(403).json({ success: false, error: 'Only CEO can approve finance workflow requests.' });
        }
        const result = await masterAI.callTool('approve_financial_workflow_request', {
            authorization_id: req.params.id,
            approved_by: authContext.email,
            note: req.body?.note || '',
            tenant_id: authContext.tenant_id || req.tenantId,
        });
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Finance Approval Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/finance/approvals/:id/reject', requireAuth, async (req, res) => {
    try {
        const authContext = await resolveAuthContext(req);
        if (!ensureActivatedAccount(authContext, res)) return;
        if (authContext.profile_type !== 'CEO') {
            return res.status(403).json({ success: false, error: 'Only CEO can reject finance workflow requests.' });
        }
        const result = await masterAI.callTool('reject_financial_workflow_request', {
            authorization_id: req.params.id,
            rejected_by: authContext.email,
            reason: req.body?.reason || '',
            tenant_id: authContext.tenant_id || req.tenantId,
        });
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Finance Rejection Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function processIncomingWhatsAppPayload(payload) {
    console.log('Incoming Webhook: received payload', {
        object: payload?.object || null,
        entries: Array.isArray(payload?.entry) ? payload.entry.length : 0
    });
    const inboundEvent = WhatsAppSimulatorBus.recordInbound(payload);

    // Route through Communications AI System Reliability Layer
    const systemEvent = await commsAI.callTool('handle_incoming_message', { payload });

    if (systemEvent) {
        const actorPhone = systemEvent?.payload?.from || systemEvent?.context?.user_id || null;
        const resolvedTenantId = actorPhone ? await resolveTenantIdByPhone(actorPhone) : null;
        if (resolvedTenantId) {
            systemEvent.context = {
                ...(systemEvent.context || {}),
                tenant_id: resolvedTenantId,
            };
        }
        console.log('System Event Generated:', JSON.stringify(systemEvent, null, 2));

        if (systemEvent.error) {
            console.error('Event Rejected by CommsAI:', systemEvent.error);
            return { inboundEvent };
        }
        await masterAI.process_event(systemEvent);
        return { inboundEvent };
    }

    // It might be a status update or unhandled type
    const statusEvent = await commsAI.callTool('handle_delivery_status', { payload });
    if (!statusEvent) return { inboundEvent };
    console.log('Status Event Generated:', JSON.stringify(statusEvent, null, 2));
    await masterAI.process_event(statusEvent);
    return { inboundEvent };
}

async function enqueueIncomingWhatsAppPayload(payload) {
    const envelope = {
        kind: 'whatsapp_webhook_received',
        payload,
        received_at: new Date().toISOString(),
    };
    return CommunicationsEventBus.publishJsonMessage(envelope, {
        source: 'whatsapp_webhook',
    });
}

// 3.1 WhatsApp Simulator (Debug) - send a synthetic inbound message into official webhook flow.
app.post('/api/simulator/whatsapp/send', requireDebugAccess, async (req, res) => {
    try {
        const from = String(req.body?.from || '').trim();
        const body = String(req.body?.body || '').trim();
        const imageUrls = Array.isArray(req.body?.image_urls) ? req.body.image_urls.filter(Boolean) : [];

        if (!from) {
            return res.status(400).json({ success: false, error: 'from is required' });
        }
        if (!body && imageUrls.length === 0) {
            return res.status(400).json({ success: false, error: 'body or image_urls is required' });
        }

        const imageMarker = imageUrls.length > 0
            ? `\n\n[Attached ${imageUrls.length} image(s) — use these as image_urls: ${imageUrls.join(', ')}]`
            : '';
        const finalBody = `${body}${imageMarker}`.trim();
        const normalizedFrom = WhatsAppSimulatorBus.normalizePhone(from);
        const syntheticMessageId = `wamid.sim.${Date.now()}`;
        const payload = {
            object: 'whatsapp_business_account',
            entry: [{
                id: 'simulator',
                changes: [{
                    field: 'messages',
                    value: {
                        messaging_product: 'whatsapp',
                        messages: [{
                            from: normalizedFrom.replace(/^\+/, ''),
                            id: syntheticMessageId,
                            timestamp: String(Math.floor(Date.now() / 1000)),
                            text: { body: finalBody },
                            type: 'text'
                        }]
                    }
                }]
            }]
        };

        const { inboundEvent } = await processIncomingWhatsAppPayload(payload);
        return res.json({
            success: true,
            data: {
                from: normalizedFrom,
                message_id: syntheticMessageId,
                body: finalBody,
                images: imageUrls,
                inbound_event: inboundEvent || null,
                synthetic_payload: {
                    object: payload?.object,
                    entry: payload?.entry
                }
            }
        });
    } catch (error) {
        console.error('WhatsApp Simulator Send Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/simulator/whatsapp/thread', requireDebugAccess, (req, res) => {
    const phone = String(req.query?.phone || '').trim();
    if (!phone) {
        return res.status(400).json({ success: false, error: 'phone query param is required' });
    }
    const items = WhatsAppSimulatorBus.listByPhone(phone);
    return res.json({ success: true, data: { phone: WhatsAppSimulatorBus.normalizePhone(phone), items } });
});

app.delete('/api/simulator/whatsapp/thread', requireDebugAccess, (req, res) => {
    const phone = String(req.query?.phone || '').trim();
    if (!phone) {
        return res.status(400).json({ success: false, error: 'phone query param is required' });
    }
    WhatsAppSimulatorBus.clearByPhone(phone);
    return res.json({ success: true, data: { phone: WhatsAppSimulatorBus.normalizePhone(phone), cleared: true } });
});

// 4. WhatsApp Webhook (Verification)
app.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 5. WhatsApp Webhook (Incoming Events)
app.post('/api/webhooks/whatsapp', async (req, res) => {
    try {
        if (CommunicationsEventBus.isPubSubEnabled()) {
            const published = await enqueueIncomingWhatsAppPayload(req.body);
            console.log('Queued WhatsApp webhook event to Pub/Sub', published);
            return res.sendStatus(200);
        }
        await processIncomingWhatsAppPayload(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook Error:', error);
        res.sendStatus(500);
    }
});

app.post('/api/internal/events/whatsapp', async (req, res) => {
    try {
        if (!CommunicationsEventBus.isPubSubEnabled()) {
            return res.status(409).json({ success: false, error: 'Communications Pub/Sub backend is not enabled.' });
        }
        await CommunicationsEventBus.verifyPushRequest(req);
        const envelope = CommunicationsEventBus.decodePushEnvelope(req.body);
        if (envelope?.kind !== 'whatsapp_webhook_received') {
            return res.status(400).json({ success: false, error: 'Unsupported internal event kind.' });
        }
        await processIncomingWhatsAppPayload(envelope.payload || {});
        return res.sendStatus(204);
    } catch (error) {
        console.error('Internal WhatsApp Event Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

async function startServer() {
    await BusinessConfig.initialize();
    await MasterAI.initializeWorkflowStore();
    ensurePredefinedFinancialWorkflows(workflowStore);

    propertyAI = new PropertyAI();
    crmAgent = new CRMAgent();
    hrAgent = new HRAgent({ crmAgent });
    financeAI = new FinanceAI();
    commsAI = new CommunicationsAI();
    masterAI = new MasterAI([propertyAI, crmAgent, hrAgent, financeAI, commsAI]);
    masterAI.attachAgentListeners([propertyAI, crmAgent, hrAgent, financeAI, commsAI]);
    allAgents = [masterAI, propertyAI, crmAgent, hrAgent, financeAI, commsAI];
    attachSystemEventListeners();

    await syncExistingTenantOwnerProfilesToCrm();
    await seedSystemDemoData();

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
