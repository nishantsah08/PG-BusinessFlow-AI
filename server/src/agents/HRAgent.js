const BaseAgent = require('./BaseAgent');
const PhoneNormalizationService = require('../services/PhoneNormalizationService');

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
        this.staff = [];
        this.salary_cards = [];
        this.leaves = [];

        this.registerTools();
    }

    registerTools() {
        // --- CORE LIFECYCLE & PROFILE ---

        this.registerTool('hire_staff', 'Hire a new staff member', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                designation: { type: 'string' },
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
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.staff.push(newStaff);

            // --- EVENT EMISSION ---
            // Fix 1: Decoupled architecture. Emit event instead of direct call.
            this.emit('staff.hired', {
                staff_id: newStaff.id,
                name: args.name,
                designation: args.designation,
                contact: args.contact,
                timestamp: new Date().toISOString()
            });

            console.log(`[HRAgent] Staff hired: ${newStaff.id}. Event 'staff.hired' emitted.`);

            return { status: "Staff Hired", staff_id: newStaff.id };
        });

        this.registerTool('update_staff_profile', 'Update staff details', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                name: { type: 'string' },
                designation: { type: 'string' },
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

            if (args.name) staffMember.name = args.name;
            if (args.designation) staffMember.designation = args.designation;
            if (args.job_description) staffMember.job_description = args.job_description;
            if (args.contact) staffMember.contact = { ...staffMember.contact, ...args.contact };

            staffMember.updated_at = new Date().toISOString();
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
                history: []
            };
            this.salary_cards.push(card);
            return { status: "Salary Card Created", staff_id: args.staff_id };
        });

        this.registerTool('update_salary_card', 'Update an existing salary agreement', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
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
                components: JSON.parse(JSON.stringify(card.components)),
                reason: args.reason
            });

            if (args.new_components) {
                // Merge top level keys
                card.components = { ...card.components, ...args.new_components };
            }

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

    getOperatingInstructions() {
        return `## HRAgent — Operating Instructions
- **Staff IDs**: Use \`STF-XX\` format. Always look up via \`get_all_staff\` if unsure.
- **Hiring**: Required fields are: name, designation, contact.primary (phone in E.164 format). If base_salary is not specified, ask.
- **Salary Card**: A salary card MUST be created after hiring. It requires: staff_id, base_salary, bank_details (account_number, ifsc). Without a salary card, FinanceAI cannot process payroll.
- **Incentive Structure**: Incentives can be defined as amount_per_unit (e.g., ₹50 per occupied unit). The formula is: metric_value × amount_per_unit.
- **Leave Management**: Leave types are: ADVANCE, EMERGENCY, CASUAL, SICK. Always specify start_date. Leaves start as PENDING and need approval.
- **Termination**: Requires a reason. Sets status to TERMINATED. Cannot be undone.`;
    }
}
module.exports = HRAgent;
