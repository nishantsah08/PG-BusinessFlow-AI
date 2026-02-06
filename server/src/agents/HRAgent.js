const BaseAgent = require('./BaseAgent');

class HRAgent extends BaseAgent {
    constructor() {
        super({
            name: 'HRAgent',
            identity: {
                role: 'Staff Manager',
                description: 'Manages staff lifecycle and compensation agreements.'
            },
            capabilities: {
                skills: ['Hiring', 'Compensation'],
                tools: ['hire_staff', 'create_salary_card', 'terminate_staff', 'get_salary_card']
            },
            directives: {
                goals: ['Accurate agreements'],
                constraints: ['Handover payment execution to Finance']
            }
        });

        this.staff = [];
        this.salaryCards = {}; // staff_id -> Card Object

        this.registerTools();
    }

    registerTools() {
        this.registerTool('hire_staff', 'Onboard new staff', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                designation: { type: 'string' },
                contact: { type: 'string' }, // phone
                base_salary: { type: 'number' }
            },
            required: ['name', 'designation']
        }, async (args) => {
            const staff = {
                id: `STF-${this.staff.length + 1}`,
                ...args,
                status: 'Active',
                joined_at: new Date().toISOString()
            };
            this.staff.push(staff);
            return { status: "Staff Hired", staff_id: staff.id };
        });

        this.registerTool('create_salary_card', 'Define salary structure', {
            type: 'object',
            properties: {
                staff_id: { type: 'string' },
                base_salary: { type: 'number' },
                components: {
                    type: 'object',
                    properties: {
                        incentives: { type: 'object' },
                        allowances: { type: 'object' }
                    }
                }
            },
            required: ['staff_id', 'base_salary']
        }, async (args) => {
            // Check staff exists
            const staff = this.staff.find(s => s.id === args.staff_id);
            if (!staff) throw new Error("Staff ID not found");

            this.salaryCards[args.staff_id] = {
                ...args,
                currency: 'INR',
                version: 1
            };
            return { status: "Salary Card Created", valid_for: args.staff_id };
        });

        // Helper for Finance Agent
        this.registerTool('get_salary_card', 'Retrieve salary card', {
            type: 'object',
            properties: { staff_id: { type: 'string' } },
            required: ['staff_id']
        }, async (args) => {
            return this.salaryCards[args.staff_id] || null;
        });
    }
}

module.exports = HRAgent;
