const MasterAI = require('../src/agents/MasterAI');
const CRMAgent = require('../src/agents/CRMAgent');
const HRAgent = require('../src/agents/HRAgent');

describe('MasterAI staff sync orchestration', () => {
    beforeEach(() => {
        process.env.STORAGE_BACKEND = 'memory';
        process.env.OPENAI_API_KEY = 'test-key';
    });

    it('creates a CRM Staff profile when HR hires a new employee', async () => {
        const crmAgent = new CRMAgent();
        const hrAgent = new HRAgent();
        const masterAI = new MasterAI([crmAgent, hrAgent]);

        await hrAgent.callTool('hire_staff', {
            tenant_id: 'tenant_hr_sync_test',
            name: 'Ajay Sharma',
            designation: 'Property Manager',
            contact: {
                primary: '+919999888877',
                email: 'ajay@example.com',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const lookup = await crmAgent.callTool('get_lead_by_phone', {
            tenant_id: 'tenant_hr_sync_test',
            phone: '+919999888877',
        });
        const salaryCard = await hrAgent.callTool('get_salary_card', {
            tenant_id: 'tenant_hr_sync_test',
            staff_id: 'STF-01',
        });

        expect(masterAI).toBeDefined();
        expect(lookup.status).toBe('Found');
        expect(lookup.lead.profile_type).toBe('Staff');
        expect(lookup.lead.email).toBe('ajay@example.com');
        expect(salaryCard.base_salary).toBeGreaterThan(0);
        expect(salaryCard.meta?.auto_generated).toBe(true);
    });

    it('uses the selected compensation profile when HR hires a caretaker', async () => {
        const crmAgent = new CRMAgent();
        const hrAgent = new HRAgent();
        const masterAI = new MasterAI([crmAgent, hrAgent]);

        await hrAgent.callTool('hire_staff', {
            tenant_id: 'tenant_hr_comp_profile_test',
            name: 'Suresh Caretaker',
            designation: 'Caretaker',
            compensation_profile: 'caretaker',
            contact: {
                primary: '+919888777666',
                email: 'suresh@example.com',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const lookup = await crmAgent.callTool('get_lead_by_phone', {
            tenant_id: 'tenant_hr_comp_profile_test',
            phone: '+919888777666',
        });
        const salaryCard = await hrAgent.callTool('get_salary_card', {
            tenant_id: 'tenant_hr_comp_profile_test',
            staff_id: 'STF-01',
        });

        expect(masterAI).toBeDefined();
        expect(lookup.status).toBe('Found');
        expect(salaryCard.meta?.compensation_profile_key).toBe('caretaker');
        expect(salaryCard.components?.caretaker_rules?.daily_cleaning_proof_amount).toBeGreaterThan(0);
        expect(salaryCard.components?.incentives?.logic).toMatch(/occupied units/i);
    });

    it('keeps CRM lookup aligned when HR updates a staff profile', async () => {
        const crmAgent = new CRMAgent();
        const hrAgent = new HRAgent();
        const masterAI = new MasterAI([crmAgent, hrAgent]);

        await hrAgent.callTool('hire_staff', {
            tenant_id: 'tenant_hr_update_sync_test',
            name: 'Rekha Singh',
            designation: 'Sales Executive',
            contact: {
                primary: '+919111222333',
                email: 'rekha@example.com',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 0));

        await hrAgent.callTool('update_staff_profile', {
            tenant_id: 'tenant_hr_update_sync_test',
            staff_id: 'STF-01',
            name: 'Rekha Singh Updated',
            designation: 'Senior Sales Executive',
            contact: {
                primary: '+919111222444',
                email: 'rekha.updated@example.com',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const lookupByNewPhone = await crmAgent.callTool('get_lead_by_phone', {
            tenant_id: 'tenant_hr_update_sync_test',
            phone: '+919111222444',
        });
        const lookupByOldPhone = await crmAgent.callTool('get_lead_by_phone', {
            tenant_id: 'tenant_hr_update_sync_test',
            phone: '+919111222333',
        });

        expect(masterAI).toBeDefined();
        expect(lookupByNewPhone.status).toBe('Found');
        expect(lookupByOldPhone.status).toBe('Found');
        expect(lookupByNewPhone.lead.profile_type).toBe('Staff');
        expect(lookupByNewPhone.lead.email).toBe('rekha.updated@example.com');
        expect(lookupByNewPhone.lead.name).toBe('Rekha Singh Updated');
    });
});
