/**
 * BusinessConfig — Single source of truth for all business rules.
 * 
 * Phase 1: Hardcoded JS object for a single tenant.
 * Phase 2 (Multi-Tenant): Replace with a config store lookup keyed by tenant_id.
 *   e.g., const config = await configStore.getByTenantId(req.tenant_id);
 */

const BusinessConfig = {
    tenant_id: 'default',
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

module.exports = BusinessConfig;
