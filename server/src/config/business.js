/**
 * BusinessConfig — Single source of truth for all business rules.
 *
 * Phase 1: Hardcoded JS object for a single tenant.
 * Phase 2 (Multi-Tenant): Keep per-tenant values in a local JSON config file.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_TENANT_ID = 'default';
const BUSINESS_CONFIG_FILE = path.join(__dirname, '..', '..', 'data', 'tenant_configs.json');

const DEFAULT_BUSINESS_CONFIG = {
    tenant_id: DEFAULT_TENANT_ID,
    business_name: 'PG-BusinessFlow.ai',

    // --- Persona & Identity ---
    persona: {
        name: 'Kalyani',
        role: 'Head of Operations & Sales',
        ceo_email: 'nishantsah@outlook.in',
        ceo_phone: '+917588498834',
        session_timeout_ms: 15 * 60 * 1000, // 15 minutes
    },

    // --- Property Rules ---
    property: {
        required_fields: ['name', 'address', 'floors', 'amenities'],
        default_amenities: ['Wi-Fi'],
    },

    // --- Rate Card (Public / Standard MRP) ---
    rates: {
        monthly_rent: 12000,
        base_security_deposit: 2500,
        deposit_rules: {
            // Days 1-5: Standard deposit only
            // Days 6-10: Standard + (daily_rent * 5) rounded to nearest 50
            dynamic_range_start: 6,
            dynamic_range_end: 10,
            dynamic_multiplier_days: 5,
            rounding: 50,
        },
        notice_period_days: 30,
        min_stay_months: 6,
        early_exit_rule: 'DEPOSIT_FORFEIT',
        rent_payment_timing: 'ADVANCE',
        utility_payment_timing: 'ARREARS',
        maintenance_fee: 0,
    },

    // --- Finance Rules ---
    finance: {
        waterfall_priority: [
            'Security Deposit',
            'Past Dues',
            'Police Verification Fee',
            'Rent',
            'Parking Fee',
            'Wi-Fi Fee',
            'Electricity Bill',
            'Asset Damage Recovery',
            'Late Payment Fees',
        ],
        late_fee_daily: 50,
        // Default salary values (used when HR card is not available)
        default_base_salary: 4000,
        default_incentive_per_unit: 350,
    },
};

function cloneConfig(source) {
    return JSON.parse(JSON.stringify(source));
}

function normalizeTenantId(tenantId) {
    const sanitized = typeof tenantId === 'string' ? tenantId.trim() : '';
    return sanitized || DEFAULT_TENANT_ID;
}

function loadTenantConfigFile() {
    if (!fs.existsSync(BUSINESS_CONFIG_FILE)) {
        return {};
    }

    try {
        const raw = fs.readFileSync(BUSINESS_CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function writeTenantConfigFile(nextValue) {
    const dir = path.dirname(BUSINESS_CONFIG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BUSINESS_CONFIG_FILE, JSON.stringify(nextValue, null, 4), 'utf8');
}

function getTenantConfigOverrides() {
    const raw = loadTenantConfigFile();
    const overrides = raw && typeof raw === 'object' ? raw : {};
    if (!overrides || typeof overrides !== 'object') {
        return {};
    }
    return overrides;
}

function buildMergedConfig(tenantId) {
    const tenantOverrides = getTenantConfigOverrides();
    const defaultCfg = cloneConfig(DEFAULT_BUSINESS_CONFIG);

    const tenantCfg = tenantOverrides[tenantId];
    if (!tenantCfg || typeof tenantCfg !== 'object') {
        defaultCfg.tenant_id = tenantId;
        return defaultCfg;
    }

    const merged = {
        ...defaultCfg,
        ...tenantCfg,
        tenant_id: tenantId,
        property: {
            ...defaultCfg.property,
            ...(tenantCfg.property || {})
        },
        rates: {
            ...defaultCfg.rates,
            ...(tenantCfg.rates || {})
        },
        finance: {
            ...defaultCfg.finance,
            ...(tenantCfg.finance || {})
        },
        persona: {
            ...defaultCfg.persona,
            ...(tenantCfg.persona || {})
        }
    };

    return merged;
}

function getAllTenantConfigs() {
    const overrides = getTenantConfigOverrides();
    const tenantIds = new Set([DEFAULT_TENANT_ID, ...Object.keys(overrides || {})]);
    const all = {};
    tenantIds.forEach((tenantId) => {
        all[tenantId] = buildMergedConfig(tenantId);
    });
    return all;
}

function getBusinessConfig(tenantId = DEFAULT_TENANT_ID) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return buildMergedConfig(normalizedTenantId);
}

function saveTenantConfig(tenantId, partialConfig = {}) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const overrides = getTenantConfigOverrides();
    overrides[normalizedTenantId] = {
        ...(overrides[normalizedTenantId] || {}),
        ...partialConfig,
        tenant_id: normalizedTenantId,
    };
    writeTenantConfigFile(overrides);
    return getBusinessConfig(normalizedTenantId);
}

function ensureDefaultTenantConfig() {
    const all = getTenantConfigOverrides();
    if (!all[DEFAULT_TENANT_ID]) {
        const defaults = getTenantConfigOverrides();
        defaults[DEFAULT_TENANT_ID] = {
            tenant_id: DEFAULT_TENANT_ID,
            business_name: DEFAULT_BUSINESS_CONFIG.business_name,
            persona: DEFAULT_BUSINESS_CONFIG.persona,
            property: DEFAULT_BUSINESS_CONFIG.property,
            rates: DEFAULT_BUSINESS_CONFIG.rates,
            finance: DEFAULT_BUSINESS_CONFIG.finance,
        };
        writeTenantConfigFile(defaults);
    }
}

const BusinessConfig = cloneConfig(DEFAULT_BUSINESS_CONFIG);

ensureDefaultTenantConfig();

module.exports = {
    ...DEFAULT_BUSINESS_CONFIG,
    getBusinessConfig,
    getAllTenantConfigs,
    saveTenantConfig,
    DEFAULT_TENANT_ID,
    BUSINESS_CONFIG_FILE
};
