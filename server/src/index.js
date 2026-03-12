const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const MasterAI = require('./agents/MasterAI');
const PropertyAI = require('./agents/PropertyAI');
const CRMAgent = require('./agents/CRMAgent');
const HRAgent = require('./agents/HRAgent');
const FinanceAI = require('./agents/FinanceAI');
const CommunicationsAI = require('./agents/CommunicationsAI');
const TimeAuthorityService = require('./services/TimeAuthorityService');
const BusinessConfig = require('./config/business');
const WorkflowStore = require('./storage/WorkflowStore');
const ImageStore = require('./storage/ImageStore');
const WhatsAppSimulatorBus = require('./observability/WhatsAppSimulatorBus');
const {
    ensurePredefinedFinancialWorkflows,
    isProtectedPredefinedWorkflow
} = require('./workflows/financialWorkflowPolicy');
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
const IMAGE_DIR = path.join(__dirname, '..', '..', 'images');
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'local';
const MIN_IMAGE_BYTES = 1024;
const workflowStore = new WorkflowStore({ backend: STORAGE_BACKEND });
const imageStore = new ImageStore({ backend: STORAGE_BACKEND, imageDir: IMAGE_DIR });
ensurePredefinedFinancialWorkflows(workflowStore);

app.use('/images', express.static(IMAGE_DIR));

const ADMIN_ADAPTER_POLICY = {
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
        'merge_leads',
        'archive_lead',
        'set_primary_phone',
    ]),
    CommunicationsAI: new Set([
        'send_text_message',
        'send_media_message',
        'send_template_message',
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
        'record_incoming_txn',
        'get_incoming_txns',
        'get_txn_details',
        'record_outgoing_txn',
        'get_expenses',
        'get_ledger',
        'add_ledger_entry',
        'generate_monthly_bills',
        'onboard_tenant_contract',
        'process_salary_payout',
        'get_financial_summary',
        'get_defaulters_list',
    ]),
};

const ADMIN_ROLE_PERMISSIONS = {
    CEO: {
        CRMAgent: new Set(Array.from(ADMIN_ADAPTER_POLICY.CRMAgent)),
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
            'get_incoming_txns',
            'get_txn_details',
            'get_expenses',
            'get_ledger',
            'get_financial_summary',
            'get_defaulters_list',
            'record_incoming_txn',
            'record_outgoing_txn',
            'add_ledger_entry',
            'generate_monthly_bills',
            'onboard_tenant_contract',
            'process_salary_payout',
        ]),
        CommunicationsAI: new Set([
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
        HRAgent: new Set([]),
        FinanceAI: new Set([
            'get_incoming_txns',
            'get_financial_summary',
            'get_defaulters_list',
            'get_ledger',
            'get_txn_details',
        ]),
        CommunicationsAI: new Set([
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

    return {
        tenant_id: tenantId,
        email: trustedEmail || null,
        profile_type: normalizedProfile,
        crm_lead_id: crmLead?.lead_id || null,
        business_name: tenantConfig?.business_name || null,
        owner: {
            name: tenantConfig?.persona?.name || 'Workspace Owner',
            email: ceoEmail || null,
            phone: tenantConfig?.persona?.ceo_phone || null,
            role: tenantConfig?.persona?.role || 'CEO',
        },
        hr_compensation_catalog: buildHrCompensationCatalog(tenantConfig),
        permissions: {
            admin_adapter: Object.fromEntries(
                Object.entries(permissions).map(([agent, tools]) => [agent, Array.from(tools)])
            ),
        },
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

        const updatedConfig = BusinessConfig.saveTenantConfig(targetTenantId, {
            business_name: deriveBusinessName(displayName, trustedEmail),
            persona: {
                name: displayName || String(trustedEmail.split('@')[0] || 'CEO'),
                role: 'CEO',
                ceo_email: trustedEmail,
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
                email: context.email,
                name: updatedConfig?.persona?.name || displayName || null,
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

// Image upload endpoint — saves files to disk and returns accessible URLs
app.post('/api/upload/images', requireAuth, upload.array('images', 20), (req, res) => {
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
            urls.push(imageStore.saveBuffer(f.buffer, f.originalname, 'prop'));
        }
        res.json({ success: true, data: { urls, skipped } });
    } catch (error) {
        console.error('Image Upload Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Initialize Agents
const propertyAI = new PropertyAI();
const crmAgent = new CRMAgent();
const hrAgent = new HRAgent({ crmAgent: crmAgent });
const financeAI = new FinanceAI();
const commsAI = new CommunicationsAI();

// Master AI knows about everyone else
const masterAI = new MasterAI([propertyAI, crmAgent, hrAgent, financeAI, commsAI]);
masterAI.attachAgentListeners([propertyAI, crmAgent, hrAgent, financeAI, commsAI]);

const allAgents = [masterAI, propertyAI, crmAgent, hrAgent, financeAI, commsAI];

async function seedSystemDemoData() {
    if (process.env.SEED_DEMO_DATA === 'false') return;
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

(async () => {
    await seedSystemDemoData();
})();

// SSE Event Clients
let sseClients = [];
let recentEvents = [];

// Subscribe to MasterAI internal events
masterAI.on('system_event', (event) => {
    recentEvents.push(event);
    if (recentEvents.length > 50) recentEvents.shift();

    // Forward to all connected SSE clients
    sseClients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
});

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
                const savedUrl = imageStore.saveBuffer(f.buffer, f.originalname, 'chat_upload');
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
    res.json({ success: true, data: { events: [...recentEvents].reverse().slice(0, req.query.limit || 20) } });
});

// 2.2 Get MasterAI Trace
app.get('/api/master_ai/trace/:id', requireAuth, (req, res) => {
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
// GET /api/workflows — list all
app.get('/api/workflows', requireAuth, (req, res) => {
    try {
        const workflows = workflowStore.list();
        res.json({ success: true, data: { workflows } });
    } catch (error) {
        console.error('Workflow List Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/workflows/:id — get single
app.get('/api/workflows/:id', requireAuth, (req, res) => {
    try {
        const wf = workflowStore.getById(req.params.id);
        if (!wf) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }
        res.json({ success: true, data: wf });
    } catch (error) {
        console.error('Workflow Get Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/workflows — create new
app.post('/api/workflows', requireAuth, (req, res) => {
    try {
        const { workflow_id, name, description, trigger_event, steps } = req.body;
        if (!workflow_id || !trigger_event || !steps) {
            return res.status(400).json({ success: false, error: 'Missing required fields: workflow_id, trigger_event, steps' });
        }

        const workflows = workflowStore.list();
        if (workflows.find(w => w.workflow_id === workflow_id)) {
            return res.status(409).json({ success: false, error: `Workflow '${workflow_id}' already exists` });
        }

        const newWorkflow = {
            workflow_id,
            name: name || '',
            description: description || '',
            trigger_event,
            steps: steps || [],
            created_at: TimeAuthorityService.nowIST()
        };
        workflows.push(newWorkflow);
        workflowStore.saveAll(workflows);

        console.log(`[Workflows] Created: ${workflow_id}`);
        res.status(201).json({ success: true, data: newWorkflow });
    } catch (error) {
        console.error('Workflow Create Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/workflows/:id — update existing
app.put('/api/workflows/:id', requireAuth, (req, res) => {
    try {
        if (isProtectedPredefinedWorkflow(req.params.id)) {
            return res.status(403).json({
                success: false,
                error: `Workflow '${req.params.id}' is system-protected and cannot be edited directly.`
            });
        }

        const workflows = workflowStore.list();
        const idx = workflows.findIndex(w => w.workflow_id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }

        const { name, description, trigger_event, steps } = req.body;
        if (name !== undefined) workflows[idx].name = name;
        if (description !== undefined) workflows[idx].description = description;
        if (trigger_event !== undefined) workflows[idx].trigger_event = trigger_event;
        if (steps !== undefined) workflows[idx].steps = steps;
        workflows[idx].updated_at = TimeAuthorityService.nowIST();

        workflowStore.saveAll(workflows);
        console.log(`[Workflows] Updated: ${req.params.id}`);
        res.json({ success: true, data: workflows[idx] });
    } catch (error) {
        console.error('Workflow Update Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/workflows/:id — delete
app.delete('/api/workflows/:id', requireAuth, (req, res) => {
    try {
        if (isProtectedPredefinedWorkflow(req.params.id)) {
            return res.status(403).json({
                success: false,
                error: `Workflow '${req.params.id}' is system-protected and cannot be deleted.`
            });
        }

        let workflows = workflowStore.list();
        const idx = workflows.findIndex(w => w.workflow_id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: `Workflow '${req.params.id}' not found` });
        }

        const deleted = workflows.splice(idx, 1)[0];
        workflowStore.saveAll(workflows);
        console.log(`[Workflows] Deleted: ${req.params.id}`);
        res.json({ success: true, data: deleted });
    } catch (error) {
        console.error('Workflow Delete Error:', error);
        res.status(500).json({ success: false, error: error.message });
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

async function processIncomingWhatsAppPayload(payload) {
    console.log('Incoming Webhook: received payload', {
        object: payload?.object || null,
        entries: Array.isArray(payload?.entry) ? payload.entry.length : 0
    });
    const inboundEvent = WhatsAppSimulatorBus.recordInbound(payload);

    // Route through Communications AI System Reliability Layer
    const systemEvent = await commsAI.callTool('handle_incoming_message', { payload });

    if (systemEvent) {
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
        await processIncomingWhatsAppPayload(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook Error:', error);
        res.sendStatus(500);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
