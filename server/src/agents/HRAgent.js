const BaseAgent = require('./BaseAgent');
const PhoneNormalizationService = require('../services/PhoneNormalizationService');
const TenantDataStore = require('../storage/TenantDataStore');
const BusinessConfig = require('../config/business');

class HRAgent extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'HRAgent',
            identity: {
                role: 'Staff Manager',
                description: 'Handles staff lifecycle, leaves, and salary-card definitions.'
            },
            capabilities: {
                skills: ['Staff Lifecycle', 'Salary Card Management', 'Leave Management'],
                tools: [
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
                    'record_caretaker_activity',
                    'get_caretaker_activity',
                    'calculate_incentive',
                    'get_performance_metrics'
                ]
            },
            directives: {
                goals: ['Maintain accurate staff records', 'Define compensation contracts for Finance'],
                constraints: ['Does not disburse money']
            },
            ...config
        });

        // Fix 1: Removed direct dependency on crmAgent
        // this.crmAgent = config.crmAgent;

        // ... (rest of constructor)
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
                    namespace: 'hr',
                    backend: this.dataBackend
                })
            );
        }
        return this._tenantStores.get(tenantId);
    }

    _getState(tenantId = this.defaultTenantId) {
        const resolvedTenantId = tenantId || this.defaultTenantId;
        if (!this._tenantStates.has(resolvedTenantId)) {
            const store = this._getTenantStore(resolvedTenantId);
            const rawState = store.load({
                staff: [],
                salary_cards: [],
                leaves: [],
                caretaker_activity: []
            });
            this._tenantStates.set(resolvedTenantId, rawState);
        }
        return this._tenantStates.get(resolvedTenantId);
    }

    _saveState(tenantId) {
        const state = this._getState(tenantId);
        this._getTenantStore(tenantId).save({
            staff: state.staff,
            salary_cards: state.salary_cards,
            leaves: state.leaves,
            caretaker_activity: state.caretaker_activity,
            lastUpdatedAt: new Date().toISOString(),
            businessConfig: this._businessConfigProvider(tenantId)
        });
    }

    _setTenantContext(tenantId) {
        const resolvedTenantId = this._extractTenantId({ tenant_id: tenantId });
        const previousTenantId = this._activeTenantId;
        this._activeTenantId = resolvedTenantId;
        this._getState(resolvedTenantId);
        return previousTenantId;
    }

    get staff() {
        return this._getState(this._activeTenantId || this.defaultTenantId).staff;
    }

    get salary_cards() {
        return this._getState(this._activeTenantId || this.defaultTenantId).salary_cards;
    }

    get leaves() {
        return this._getState(this._activeTenantId || this.defaultTenantId).leaves;
    }

    get caretaker_activity() {
        return this._getState(this._activeTenantId || this.defaultTenantId).caretaker_activity;
    }

    _normalizeDesignationKey(designation = '') {
        return String(designation || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    _getCompensationTemplateForDesignation(designation, tenantId = this._activeTenantId || this.defaultTenantId, preferredTemplateKey = '') {
        const config = this._businessConfigProvider(tenantId) || {};
        const financeConfig = config.finance || {};
        const designationKey = this._normalizeDesignationKey(designation);
        const preferredKey = this._normalizeDesignationKey(preferredTemplateKey);
        const templates = financeConfig.staff_compensation_templates || {};
        const caretakerComp = financeConfig.caretaker_compensation || {};
        const defaultBaseSalary = Number(financeConfig.default_base_salary) || 4000;
        const defaultIncentive = Number(financeConfig.default_incentive_per_unit) || 0;

        const defaultTemplate = templates.default || {
            base_salary: defaultBaseSalary,
            components: {
                compensation_model: 'STANDARD',
                salary_advance_limit: 5000,
                reimbursements_allowed: true,
                incentives: {
                    logic: 'Role-based performance incentive',
                    amount_per_unit: defaultIncentive,
                },
                allowances: {
                    travel: 0,
                    phone: 0,
                },
            },
        };

        const caretakerTemplate = templates.caretaker || {
            base_salary: Number(caretakerComp.fixed_basic_salary) || defaultBaseSalary,
            components: {
                compensation_model: 'CARETAKER_UNIT_BASED',
                salary_advance_limit: 5000,
                reimbursements_allowed: true,
                incentives: {
                    logic: 'Fully paid occupied units * amount per unit',
                    amount_per_unit: Number(caretakerComp.per_fully_paid_occupied_unit) || defaultIncentive,
                },
                allowances: {
                    travel: 0,
                    phone: 0,
                },
                caretaker_rules: {
                    daily_cleaning_proof_amount: Number(caretakerComp.daily_cleaning_proof_amount) || 100,
                    weekly_parking_cleaning_amount: Number(caretakerComp.weekly_parking_cleaning_amount) || 100,
                    maintenance_complaint_deduction: Number(caretakerComp.maintenance_complaint_deduction) || 100,
                },
            },
        };

        let resolvedTemplate = defaultTemplate;
        let templateKey = 'default';

        if (preferredKey === 'caretaker') {
            resolvedTemplate = caretakerTemplate;
            templateKey = 'caretaker';
        } else if (preferredKey === 'default') {
            resolvedTemplate = defaultTemplate;
            templateKey = 'default';
        } else if (preferredKey && templates[preferredKey]) {
            resolvedTemplate = templates[preferredKey];
            templateKey = preferredKey;
        } else if (designationKey.includes('caretaker')) {
            resolvedTemplate = caretakerTemplate;
            templateKey = 'caretaker';
        } else if (templates[designationKey]) {
            resolvedTemplate = templates[designationKey];
            templateKey = designationKey;
        }

        return {
            templateKey,
            template: JSON.parse(JSON.stringify(resolvedTemplate)),
        };
    }

    _buildAutoSalaryCard(staffMember, tenantId = this._activeTenantId || this.defaultTenantId, overrides = {}) {
        const explicitProfileKey = overrides.compensation_profile || staffMember.compensation_profile || '';
        const { templateKey, template } = this._getCompensationTemplateForDesignation(
            staffMember.designation,
            tenantId,
            explicitProfileKey
        );
        const baseSalary = Number(overrides.base_salary)
            || Number(template.base_salary)
            || Number(this._businessConfigProvider(tenantId)?.finance?.default_base_salary)
            || 4000;

        return {
            staff_id: staffMember.id,
            base_salary: baseSalary,
            bank_details: {
                account_holder: staffMember.name,
                account_number: '',
                ifsc: '',
                bank_name: '',
                upi_id: '',
            },
            components: {
                ...(template.components || {}),
            },
            effective_from: overrides.effective_from || new Date().toISOString().slice(0, 10),
            created_at: new Date().toISOString(),
            history: [],
            meta: {
                source: 'AUTO_DESIGNATION_TEMPLATE',
                auto_generated: true,
                manual_override: false,
                compensation_profile_key: templateKey,
                designation_template_key: templateKey,
                designation_snapshot: staffMember.designation,
            }
        };
    }

    _ensureAutoSalaryCardForStaff(staffMember, tenantId = this._activeTenantId || this.defaultTenantId, overrides = {}) {
        if (!staffMember?.id) return null;
        const existingCard = this.salary_cards.find((card) => card.staff_id === staffMember.id);
        if (existingCard) return existingCard;

        const card = this._buildAutoSalaryCard(staffMember, tenantId, overrides);
        this.salary_cards.push(card);
        return card;
    }

    _refreshAutoSalaryCardForStaff(staffMember, tenantId = this._activeTenantId || this.defaultTenantId) {
        if (!staffMember?.id) return null;
        const card = this.salary_cards.find((entry) => entry.staff_id === staffMember.id);
        if (!card || card.meta?.manual_override || card.meta?.source !== 'AUTO_DESIGNATION_TEMPLATE') {
            return card || null;
        }

        const regenerated = this._buildAutoSalaryCard(staffMember, tenantId, {
            effective_from: card.effective_from,
        });

        card.base_salary = regenerated.base_salary;
        card.components = regenerated.components;
        card.bank_details = {
            ...regenerated.bank_details,
            ...(card.bank_details || {}),
            account_holder: (card.bank_details?.account_holder || '').trim() || staffMember.name,
        };
        card.meta = {
            ...(card.meta || {}),
            ...regenerated.meta,
        };

        return card;
    }

    registerTools() {
        // --- CORE LIFECYCLE & PROFILE ---

        this.registerTool('hire_staff', 'Hire a new staff member', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                designation: { type: 'string' },
                compensation_profile: { type: 'string' },
                job_description: { type: 'string' },
                contact: {
                    type: 'object',
                    properties: {
                        primary: { type: 'string' },
                        email: { type: 'string' },
                        alternate: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['primary']
                },
                base_salary: { type: 'number' }
            },
            required: ['name', 'designation', 'contact']
        }, async (args) => {
            if (!args.name || !args.designation || !args.contact || !args.contact.primary) {
                throw new Error("Missing required fields: name, designation, contact.primary");
            }

            try {
                args.contact.primary = PhoneNormalizationService.normalizeToE164(args.contact.primary);
                if (args.contact.alternate) {
                    args.contact.alternate = args.contact.alternate.map(p => PhoneNormalizationService.normalizeToE164(p));
                }
            } catch (err) {
                return { status: "Invalid Input", message: "Invalid phone number format provided in contacts" };
            }

            if (this.staff.some(s => s.contact.primary === args.contact.primary && s.status !== 'TERMINATED')) {
                throw new Error(`Staff with primary contact ${args.contact.primary} already exists.`);
            }

            const newStaff = {
                id: `STF-${String(this.staff.length + 1).padStart(2, '0')}`,
                ...args,
                compensation_profile: args.compensation_profile || null,
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.staff.push(newStaff);
            const autoCard = this._ensureAutoSalaryCardForStaff(newStaff, args.tenant_id || this._activeTenantId || this.defaultTenantId, {
                base_salary: args.base_salary,
                compensation_profile: args.compensation_profile,
            });

            // --- EVENT EMISSION ---
            // Fix 1: Decoupled architecture. Emit event instead of direct call.
            this.emit('staff.hired', {
                staff_id: newStaff.id,
                name: args.name,
                designation: args.designation,
                job_description: args.job_description || '',
                contact: args.contact,
                compensation_profile: args.compensation_profile || null,
                tenant_id: args.tenant_id || this._activeTenantId || this.defaultTenantId,
                timestamp: new Date().toISOString()
            });

            console.log(`[HRAgent] Staff hired: ${newStaff.id}. Event 'staff.hired' emitted.`);

            return {
                status: "Staff Hired",
                staff_id: newStaff.id,
                compensation_status: autoCard ? 'AUTO_GENERATED' : 'PENDING',
                compensation_template_key: autoCard?.meta?.designation_template_key || null
            };
        });

        this.registerTool('update_staff_profile', 'Update staff details', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                name: { type: 'string' },
                designation: { type: 'string' },
                compensation_profile: { type: 'string' },
                job_description: { type: 'string' },
                contact: {
                    type: 'object',
                    properties: {
                        primary: { type: 'string' },
                        email: { type: 'string' },
                        alternate: { type: 'array', items: { type: 'string' } }
                    }
                }
            },
            required: ['staff_id']
        }, async (args) => {
            const staffMember = this.staff.find(s => s.id === args.staff_id);
            if (!staffMember) throw new Error("Staff not found.");

            const previousContact = {
                primary: staffMember.contact?.primary || null,
                email: staffMember.contact?.email || null,
                alternate: Array.isArray(staffMember.contact?.alternate) ? [...staffMember.contact.alternate] : [],
            };

            if (args.contact?.primary) {
                try {
                    args.contact.primary = PhoneNormalizationService.normalizeToE164(args.contact.primary);
                } catch (err) {
                    return { status: "Invalid Input", message: "Invalid primary phone number format provided in contacts" };
                }
            }

            if (Array.isArray(args.contact?.alternate)) {
                try {
                    args.contact.alternate = args.contact.alternate.map((phone) => PhoneNormalizationService.normalizeToE164(phone));
                } catch (err) {
                    return { status: "Invalid Input", message: "Invalid alternate phone number format provided in contacts" };
                }
            }

            if (args.contact?.primary) {
                const conflictingStaff = this.staff.find((staff) =>
                    staff.id !== staffMember.id &&
                    staff.status !== 'TERMINATED' &&
                    staff.contact?.primary === args.contact.primary
                );
                if (conflictingStaff) {
                    throw new Error(`Staff with primary contact ${args.contact.primary} already exists.`);
                }
            }

            if (args.name) staffMember.name = args.name;
            if (args.designation) staffMember.designation = args.designation;
            if (typeof args.compensation_profile === 'string') staffMember.compensation_profile = args.compensation_profile || null;
            if (args.job_description) staffMember.job_description = args.job_description;
            if (args.contact) staffMember.contact = { ...staffMember.contact, ...args.contact };

            staffMember.updated_at = new Date().toISOString();
            this._refreshAutoSalaryCardForStaff(staffMember, args.tenant_id || this._activeTenantId || this.defaultTenantId);

            this.emit('staff.profile_updated', {
                staff_id: staffMember.id,
                name: staffMember.name,
                designation: staffMember.designation,
                job_description: staffMember.job_description || '',
                contact: staffMember.contact,
                compensation_profile: staffMember.compensation_profile || null,
                previous_contact: previousContact,
                tenant_id: args.tenant_id || this._activeTenantId || this.defaultTenantId,
                timestamp: new Date().toISOString()
            });

            return { status: "Staff Profile Updated", staff_id: staffMember.id };
        });

        this.registerTool('terminate_staff', 'Terminate a staff member', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                reason: { type: 'string' },
                last_working_day: { type: 'string' }
            },
            required: ['staff_id', 'reason']
        }, async (args) => {
            const staffMember = this.staff.find(s => s.id === args.staff_id);
            if (!staffMember) throw new Error("Staff not found.");

            if (staffMember.status === 'TERMINATED') throw new Error("Staff is already terminated.");

            staffMember.status = 'TERMINATED';
            staffMember.reason_for_termination = args.reason;
            staffMember.last_working_day = args.last_working_day || new Date().toISOString();
            staffMember.updated_at = new Date().toISOString();

            return { status: "Staff Terminated", staff_id: staffMember.id };
        });

        this.registerTool('get_staff_details', 'Get details of a staff member', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' }
            },
            required: ['staff_id']
        }, async (args) => {
            const staffMember = this.staff.find(s => s.id === args.staff_id);
            return staffMember || { error: "Staff not found" };
        });

        this.registerTool('get_all_staff', 'Get list of all staff', {
            type: 'object',
            properties: {
                status_filter: { type: 'string', enum: ['ACTIVE', 'TERMINATED'] },
                designation_filter: { type: 'string' }
            }
        }, async (args) => {
            let result = this.staff;
            if (args.status_filter) result = result.filter(s => s.status === args.status_filter);
            if (args.designation_filter) result = result.filter(s => s.designation === args.designation_filter);
            return result;
        });

        // --- COMPENSATION & FINANCE HANDOVER ---

        this.registerTool('create_salary_card', 'Create a salary agreement', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                bank_details: {
                    type: 'object',
                    properties: {
                        account_holder: { type: 'string' },
                        account_number: { type: 'string' },
                        ifsc: { type: 'string' },
                        bank_name: { type: 'string' },
                        upi_id: { type: 'string' },
                        qr_code_image: { type: 'string' }
                    },
                    required: ['account_number', 'ifsc']
                },
                base_salary: { type: 'number' },
                components: {
                    type: 'object',
                    properties: {
                        salary_advance_limit: { type: 'number' },
                        reimbursements_allowed: { type: 'boolean' },
                        incentives: {
                            type: 'object',
                            properties: {
                                logic: { type: 'string' },
                                amount_per_unit: { type: 'number' }
                            }
                        },
                        allowances: {
                            type: 'object',
                            properties: {
                                travel: { type: 'number' },
                                phone: { type: 'number' }
                            }
                        }
                    }
                },
                effective_from: { type: 'string' }
            },
            required: ['staff_id', 'base_salary', 'bank_details']
        }, async (args) => {
            if (!args.staff_id || args.base_salary === undefined || !args.bank_details || !args.bank_details.account_number || !args.bank_details.ifsc) {
                throw new Error("Missing required fields: staff_id, base_salary, bank_details (account_number, ifsc)");
            }

            const staffMember = this.staff.find(s => s.id === args.staff_id);
            if (!staffMember) throw new Error("Staff not found.");

            const existingCard = this.salary_cards.find(c => c.staff_id === args.staff_id);
            if (existingCard) {
                throw new Error("Salary card already exists. Use update_salary_card.");
            }

            const card = {
                ...args,
                created_at: new Date().toISOString(),
                history: [],
                meta: {
                    source: 'MANUAL',
                    auto_generated: false,
                    manual_override: true,
                    designation_template_key: null,
                    designation_snapshot: staffMember.designation,
                }
            };
            this.salary_cards.push(card);
            return { status: "Salary Card Created", staff_id: args.staff_id };
        });

        this.registerTool('update_salary_card', 'Update an existing salary agreement', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                new_base_salary: { type: 'number' },
                new_bank_details: { type: 'object' },
                new_components: { type: 'object' },
                reason: { type: 'string' }
            },
            required: ['staff_id', 'reason']
        }, async (args) => {
            const card = this.salary_cards.find(c => c.staff_id === args.staff_id);
            if (!card) throw new Error("Salary card not found.");

            // Archive current state to history
            card.history.push({
                date: new Date().toISOString(),
                base_salary: card.base_salary,
                bank_details: JSON.parse(JSON.stringify(card.bank_details || {})),
                components: JSON.parse(JSON.stringify(card.components)),
                reason: args.reason
            });

            if (args.new_components) {
                // Merge top level keys
                card.components = { ...card.components, ...args.new_components };
            }

            if (args.new_base_salary !== undefined && args.new_base_salary !== null) {
                card.base_salary = Number(args.new_base_salary);
            }

            if (args.new_bank_details && typeof args.new_bank_details === 'object') {
                card.bank_details = { ...(card.bank_details || {}), ...args.new_bank_details };
            }

            card.meta = {
                ...(card.meta || {}),
                auto_generated: false,
                manual_override: true,
                last_manual_update_at: new Date().toISOString(),
            };

            return { status: "Salary Card Updated", staff_id: args.staff_id };
        });

        this.registerTool('get_salary_card', 'Get active salary card', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' }
            },
            required: ['staff_id']
        }, async (args) => {
            const card = this.salary_cards.find(c => c.staff_id === args.staff_id);
            return card || { error: "Salary card not found" };
        });

        // --- LEAVE & ATTENDANCE MANAGEMENT ---

        this.registerTool('record_leave', 'Record a staff leave', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                leave_type: { type: 'string', enum: ['ADVANCE', 'EMERGENCY', 'CASUAL', 'SICK'] },
                start_date: { type: 'string' },
                end_date: { type: 'string' },
                reason: { type: 'string' }
            },
            required: ['staff_id', 'leave_type', 'start_date']
        }, async (args) => {
            const validTypes = ['ADVANCE', 'EMERGENCY', 'CASUAL', 'SICK'];
            if (!validTypes.includes(args.leave_type)) {
                throw new Error(`Invalid leave_type. Must be one of: ${validTypes.join(', ')}`);
            }

            const staffMember = this.staff.find(s => s.id === args.staff_id);
            if (!staffMember) throw new Error("Staff not found.");

            const leave = {
                id: `LEAVE-${this.leaves.length + 1}`,
                ...args,
                status: 'PENDING',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.leaves.push(leave);
            return { status: "Leave Recorded", leave_id: leave.id };
        });

        this.registerTool('get_staff_leaves', 'Get leaves for a staff member', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                month: { type: 'number' },
                year: { type: 'number' }
            },
            required: ['staff_id']
        }, async (args) => {
            let result = this.leaves.filter(l => l.staff_id === args.staff_id);
            if (args.month && args.year) {
                result = result.filter(l => {
                    const d = new Date(l.start_date);
                    return d.getMonth() + 1 === args.month && d.getFullYear() === args.year;
                });
            }
            return result;
        });

        this.registerTool('approve_leave_request', 'Approve or Reject a leave request', {
            type: 'object',
            properties: {
                request_id: { type: 'string' },
                status: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
                approver_note: { type: 'string' }
            },
            required: ['request_id', 'status']
        }, async (args) => {
            const leave = this.leaves.find(l => l.id === args.request_id);
            if (!leave) throw new Error("Leave request not found.");

            leave.status = args.status;
            if (args.approver_note) leave.approver_note = args.approver_note;
            leave.updated_at = new Date().toISOString();

            return { status: "Leave Updated", leave_id: leave.id, current_status: leave.status };
        });

        this.registerTool('record_caretaker_activity', 'Record caretaker proof-based work activity', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                activity_type: { type: 'string', enum: ['DAILY_CLEANING', 'PARKING_CLEANING'] },
                occurred_at: { type: 'string' },
                proof_url: { type: 'string' },
                property_id: { type: 'string' },
                unit_id: { type: 'string' },
                notes: { type: 'string' }
            },
            required: ['staff_id', 'activity_type', 'occurred_at', 'proof_url']
        }, async (args) => {
            const staffMember = this.staff.find(s => s.id === args.staff_id);
            if (!staffMember) throw new Error("Staff not found.");

            const activity = {
                id: `CT-ACT-${this.caretaker_activity.length + 1}`,
                staff_id: args.staff_id,
                activity_type: args.activity_type,
                occurred_at: args.occurred_at,
                proof_url: args.proof_url,
                property_id: args.property_id || null,
                unit_id: args.unit_id || null,
                notes: args.notes || '',
                created_at: new Date().toISOString()
            };

            this.caretaker_activity.push(activity);
            return { status: "Caretaker Activity Recorded", activity_id: activity.id };
        });

        this.registerTool('get_caretaker_activity', 'Get caretaker proof logs', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                activity_type: { type: 'string', enum: ['DAILY_CLEANING', 'PARKING_CLEANING'] },
                from_date: { type: 'string' },
                to_date: { type: 'string' }
            },
            required: ['staff_id']
        }, async (args) => {
            let result = this.caretaker_activity.filter((entry) => entry.staff_id === args.staff_id);
            if (args.activity_type) {
                result = result.filter((entry) => entry.activity_type === args.activity_type);
            }
            if (args.from_date) {
                const fromTs = new Date(args.from_date).getTime();
                result = result.filter((entry) => new Date(entry.occurred_at).getTime() >= fromTs);
            }
            if (args.to_date) {
                const toTs = new Date(args.to_date).getTime();
                result = result.filter((entry) => new Date(entry.occurred_at).getTime() <= toTs);
            }
            return result;
        });

        // --- PERFORMANCE & INCENTIVES ---

        this.registerTool('calculate_incentive', 'Calculate incentive amount', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                metric_value: { type: 'number' } // e.g. Units Occupied
            },
            required: ['staff_id', 'metric_value']
        }, async (args) => {
            const card = this.salary_cards.find(c => c.staff_id === args.staff_id);
            if (!card) throw new Error("Salary card not found.");

            if (!card.components || !card.components.incentives) {
                return { incentive_amount: 0, reason: "No incentives defined" };
            }

            const { incentives } = card.components;
            let amount = 0;
            let formula = "N/A";

            if (incentives.amount_per_unit) {
                amount = args.metric_value * incentives.amount_per_unit;
                formula = `${args.metric_value} (Units) * ${incentives.amount_per_unit} (Per Unit)`;
            }

            return {
                staff_id: args.staff_id,
                incentive_amount: amount,
                formula_applied: formula
            };
        });

    this.registerTool('get_performance_metrics', 'Get staff performance metrics', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                month: { type: 'number' }
            },
            required: ['staff_id']
        }, async (args) => {
            return {
                staff_id: args.staff_id,
                period: args.month ? `Month ${args.month}` : "Current",
                metrics: {
                    occupancy_rate: "85%", // Dummy
                    tickets_resolved: 12,   // Dummy
                    tenant_rating: 4.5      // Dummy
                },
                note: "Simulated Phase 1 Metrics"
            };
        });
    }

    async callTool(name, args = {}) {
        const tenantId = this._extractTenantId(args);
        const normalizedArgs = { ...args, tenant_id: args.tenant_id || tenantId };
        const previousTenantId = this._setTenantContext(tenantId);

        try {
            const result = await super.callTool(name, normalizedArgs);
            this._saveState(tenantId);
            return result;
        } finally {
            this._activeTenantId = previousTenantId;
        }
    }

    getOperatingInstructions() {
        return `## HRAgent — Operating Instructions
- **Staff IDs**: Use \`STF-XX\` format. Always look up via \`get_all_staff\` if unsure.
- **Hiring**: Required fields are: name, designation, contact.primary (phone in E.164 format). If base_salary is not specified, use designation/business compensation rules.
- **Compensation**: Hiring auto-generates a salary card from designation/business rules. Use \`update_salary_card\` to review or override the generated agreement when needed.
- **Incentive Structure**: Incentives can be defined as amount_per_unit (e.g., ₹50 per occupied unit). The formula is: metric_value × amount_per_unit.
- **Leave Management**: Leave types are: ADVANCE, EMERGENCY, CASUAL, SICK. Always specify start_date. Leaves start as PENDING and need approval.
- **Termination**: Requires a reason. Sets status to TERMINATED. Cannot be undone.`;
    }
}
module.exports = HRAgent;
