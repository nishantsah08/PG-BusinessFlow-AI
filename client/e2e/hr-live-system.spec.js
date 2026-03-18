import { test, expect } from '@playwright/test';
import { apiBaseUrl, bootstrapTenant, verifyCeoPhone } from './helpers/auth';

const getLeadPrimaryPhone = (lead) => lead?.phones?.primary?.number || lead?.lead_id || null;
const executeTool = async (request, apiBaseUrl, tenantId, ceoEmail, agentName, toolName, parameters) => {
    const response = await request.post(`${apiBaseUrl}/api/master_ai/tools/execute`, {
        headers: {
            'X-Actor-Email': ceoEmail,
            'X-Tenant-ID': tenantId,
        },
        data: {
            agent_name: agentName,
            tool_name: toolName,
            parameters,
        },
    });
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.success).toBeTruthy();
    return json;
};

test.describe('HR live system flow', () => {
    test('validates HR GUI changes against CRM sync and WhatsApp ingress', async ({ page, request }) => {
        test.setTimeout(180000);

        const stamp = Date.now();
        page.on('pageerror', (error) => {
            console.log(`pageerror: ${error.message}`);
        });
        page.on('console', (message) => {
            console.log(`browser-console:${message.type()}:${message.text()}`);
        });

        const ceoEmail = `hr.gui.qa.${stamp}@example.com`;
        const ceoPhone = `+9175${String(stamp).slice(-8)}`;
        const initialName = `HR QA ${stamp}`;
        const initialDesignation = 'Caretaker';
        const initialPhone = `+9188${String(stamp).slice(-8)}`;
        const initialEmployeeEmail = `staff.${stamp}@example.com`;
        const initialJobDescription = `Initial onboarding test ${stamp}`;

        const updatedName = `${initialName} Updated`;
        const updatedDesignation = 'Caretaker Lead';
        const updatedPhone = `+9177${String(stamp).slice(-8)}`;
        const updatedEmployeeEmail = `staff.updated.${stamp}@example.com`;
        const updatedJobDescription = `Updated onboarding test ${stamp}`;
        const firstCompensation = {
            baseSalary: '26500',
            dailyCleaning: '180',
            perUnitPayout: '450',
            travelAllowance: '1500',
            phoneAllowance: '700',
            weeklyParking: '300',
            complaintDeduction: '220',
        };
        const secondCompensation = {
            baseSalary: '27800',
            dailyCleaning: '240',
            perUnitPayout: '525',
            travelAllowance: '1800',
            phoneAllowance: '900',
            weeklyParking: '350',
            complaintDeduction: '260',
        };
        const bankDetails = {
            accountHolder: updatedName,
            accountNumber: `${stamp}123456`,
            ifsc: 'HDFC0004321',
            bankName: 'HDFC Bank',
            upiId: `hr.qa.${stamp}@oksbi`,
        };

        console.log('step: bootstrap signup');
        const signup = await bootstrapTenant(request, {
            email: ceoEmail,
            name: `HR GUI QA ${stamp}`,
        });
        const tenantId = signup?.tenant_id;
        expect(tenantId).toBeTruthy();
        await verifyCeoPhone(request, { tenantId, email: ceoEmail, phone: ceoPhone });
        console.log(`step: bootstrap ready tenant=${tenantId}`);

        console.log('step: hydrate auth and open hr');
        await page.addInitScript(({ email, tenantId, name }) => {
            window.localStorage.setItem('master_ai_user', JSON.stringify({
                email,
                name,
                tenant_id: tenantId,
                tenantId,
                profile_type: 'CEO',
                type: 'Bypass',
            }));
        }, { email: ceoEmail, tenantId, name: `HR GUI QA ${stamp}` });

        await page.goto('/hr');
        await expect(page.getByRole('heading', { name: 'People and compensation' })).toBeVisible();
        console.log('step: hr page loaded');

        await expect(page.getByTestId('hr-person-detail')).toContainText('CEO / Workspace Owner');
        await expect(page.getByText('Owner email is visible but cannot be edited in HR.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Profile' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Add Employee' }).click();
        await page.getByPlaceholder('Employee name').fill(initialName);
        await expect(page.getByText('Template Employee')).toBeVisible();
        await expect(page.getByText('Caretaker', { exact: true })).toBeVisible();
        await expect(page.getByText('Caretaker Standard')).toBeVisible();
        await expect(page.getByText(/daily cleaning payout/i)).toBeVisible();
        await page.getByPlaceholder('Primary phone').fill('5465');
        await page.getByRole('button', { name: 'Save Employee' }).click();
        await expect(page.getByText('Invalid phone number format provided in contacts')).toBeVisible();
        await page.getByPlaceholder('Primary phone').fill(initialPhone);
        await page.getByPlaceholder('Email').fill(initialEmployeeEmail);
        await page.getByPlaceholder('Job description').fill(initialJobDescription);
        await page.getByRole('button', { name: 'Save Employee' }).click();
        await expect(page.getByPlaceholder('Employee name')).toHaveCount(0);
        await expect(page.locator('[data-testid="hr-people-roster"]')).toContainText(initialName);
        console.log('step: employee added');

        await page.getByPlaceholder('Search people').fill(initialName);
        await page.getByRole('button', { name: new RegExp(initialName) }).click();
        await expect(page.getByTestId('hr-person-detail')).toContainText(initialName);
        await expect(page.getByTestId('hr-person-detail')).toContainText(initialPhone);
        await expect(page.getByTestId('hr-person-detail')).toContainText(initialEmployeeEmail);
        await expect(page.getByTestId('hr-person-detail')).toContainText(initialJobDescription);
        await expect(page.getByTestId('hr-person-detail')).toContainText('Auto-configured from profile');
        await expect(page.getByTestId('hr-person-detail')).toContainText('Caretaker Standard');
        await expect(page.getByRole('button', { name: 'Review Compensation' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Bank Details' })).toBeVisible();

        const staffAfterHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        const hiredStaff = Array.isArray(staffAfterHireJson.data)
            ? staffAfterHireJson.data.find((person) => person.contact?.primary === initialPhone)
            : null;
        expect(hiredStaff?.name).toBe(initialName);
        expect(hiredStaff?.designation).toBe(initialDesignation);
        expect(hiredStaff?.contact?.email).toBe(initialEmployeeEmail);
        expect(hiredStaff?.job_description).toBe(initialJobDescription);

        const salaryCardAfterHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_salary_card',
            { staff_id: hiredStaff.id }
        );
        expect(salaryCardAfterHireJson.data?.base_salary).toBe(4000);
        expect(salaryCardAfterHireJson.data?.components?.incentives?.amount_per_unit).toBe(250);
        expect(salaryCardAfterHireJson.data?.components?.caretaker_rules?.daily_cleaning_proof_amount).toBe(100);
        expect(salaryCardAfterHireJson.data?.components?.caretaker_rules?.weekly_parking_cleaning_amount).toBe(100);
        expect(salaryCardAfterHireJson.data?.components?.caretaker_rules?.maintenance_complaint_deduction).toBe(100);

        const crmLookupAfterHireJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'CRMAgent',
            'get_lead_by_phone',
            { phone: initialPhone }
        );
        expect(crmLookupAfterHireJson.data?.status).toBe('Found');
        expect(crmLookupAfterHireJson.data?.lead?.profile_type).toBe('Staff');
        expect(getLeadPrimaryPhone(crmLookupAfterHireJson.data?.lead)).toBe(initialPhone);
        console.log('step: crm sync after hire confirmed');

        await request.delete(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(initialPhone)}`);
        const whatsappSend = await request.post(`${apiBaseUrl}/api/simulator/whatsapp/send`, {
            data: {
                from: initialPhone,
                body: `HR GUI QA ping ${stamp}`,
            },
        });
        expect(whatsappSend.ok()).toBeTruthy();
        const whatsappThread = await request.get(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(initialPhone)}`);
        expect(whatsappThread.ok()).toBeTruthy();
        const whatsappThreadJson = await whatsappThread.json();
        expect(whatsappThreadJson.success).toBeTruthy();
        expect(Array.isArray(whatsappThreadJson.data?.items)).toBeTruthy();
        expect(whatsappThreadJson.data.items.length).toBeGreaterThanOrEqual(2);
        console.log(`step: whatsapp thread items=${whatsappThreadJson.data.items.length}`);

        await page.getByRole('button', { name: 'Edit Profile' }).click();
        await page.getByPlaceholder('Employee name').fill(updatedName);
        await page.getByPlaceholder('Designation').fill(updatedDesignation);
        await page.getByPlaceholder('Primary phone').fill(updatedPhone);
        await page.getByPlaceholder('Email').fill(updatedEmployeeEmail);
        await page.getByPlaceholder('Job description').fill(updatedJobDescription);
        await page.getByRole('button', { name: 'Save Profile' }).click();
        await expect(page.getByText('Employee profile updated.')).toBeVisible();
        console.log('step: employee updated');

        await page.getByPlaceholder('Search people').fill(updatedName);
        await page.getByRole('button', { name: new RegExp(updatedName) }).click();
        await expect(page.getByTestId('hr-person-detail')).toContainText(updatedName);
        await expect(page.getByTestId('hr-person-detail')).toContainText(updatedDesignation);
        await expect(page.getByTestId('hr-person-detail')).toContainText(updatedPhone);
        await expect(page.getByTestId('hr-person-detail')).toContainText(updatedEmployeeEmail);
        await expect(page.getByTestId('hr-person-detail')).toContainText(updatedJobDescription);

        const staffAfterProfileUpdateJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        const updatedStaff = Array.isArray(staffAfterProfileUpdateJson.data)
            ? staffAfterProfileUpdateJson.data.find((person) => person.id === hiredStaff.id)
            : null;
        expect(updatedStaff?.name).toBe(updatedName);
        expect(updatedStaff?.designation).toBe(updatedDesignation);
        expect(updatedStaff?.contact?.primary).toBe(updatedPhone);
        expect(updatedStaff?.contact?.email).toBe(updatedEmployeeEmail);
        expect(updatedStaff?.job_description).toBe(updatedJobDescription);

        await page.getByRole('button', { name: 'Review Compensation' }).click();
        const compensationForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save Compensation' }) });
        await expect(compensationForm.getByText('Compensation Formula', { exact: true })).toBeVisible();
        await expect(compensationForm.getByText('Per-Unit Payout', { exact: true })).toBeVisible();
        await expect(compensationForm.getByText('Complaint Deduction', { exact: true })).toBeVisible();
        await page.getByPlaceholder('Base salary').fill(firstCompensation.baseSalary);
        await page.getByPlaceholder('Daily cleaning payout').fill(firstCompensation.dailyCleaning);
        await page.getByPlaceholder('Per-unit payout').fill(firstCompensation.perUnitPayout);
        await page.getByPlaceholder('Travel allowance').fill(firstCompensation.travelAllowance);
        await page.getByPlaceholder('Phone allowance').fill(firstCompensation.phoneAllowance);
        await page.getByPlaceholder('Weekly parking payout').fill(firstCompensation.weeklyParking);
        await page.getByPlaceholder('Complaint deduction').fill(firstCompensation.complaintDeduction);
        await page.getByRole('button', { name: 'Save Compensation' }).click();
        await expect(page.getByText('Compensation saved.')).toBeVisible();
        await expect(page.getByText('INR 26,500')).toBeVisible();
        await expect(page.getByTestId('hr-person-detail')).toContainText('Travel 1500 • Phone 700');
        await expect(page.getByTestId('hr-person-detail')).toContainText('Daily cleaning 180 • Parking 300 • Complaint deduction 220');
        await expect(page.getByRole('button', { name: 'Edit Compensation' })).toBeVisible();
        console.log('step: compensation reviewed');

        const salaryCardAfterCompReviewJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_salary_card',
            { staff_id: hiredStaff.id }
        );
        expect(salaryCardAfterCompReviewJson.data?.base_salary).toBe(Number(firstCompensation.baseSalary));
        expect(salaryCardAfterCompReviewJson.data?.components?.incentives?.amount_per_unit).toBe(Number(firstCompensation.perUnitPayout));
        expect(salaryCardAfterCompReviewJson.data?.components?.allowances?.travel).toBe(Number(firstCompensation.travelAllowance));
        expect(salaryCardAfterCompReviewJson.data?.components?.allowances?.phone).toBe(Number(firstCompensation.phoneAllowance));
        expect(salaryCardAfterCompReviewJson.data?.components?.caretaker_rules?.daily_cleaning_proof_amount).toBe(Number(firstCompensation.dailyCleaning));
        expect(salaryCardAfterCompReviewJson.data?.components?.caretaker_rules?.weekly_parking_cleaning_amount).toBe(Number(firstCompensation.weeklyParking));
        expect(salaryCardAfterCompReviewJson.data?.components?.caretaker_rules?.maintenance_complaint_deduction).toBe(Number(firstCompensation.complaintDeduction));

        await page.getByRole('button', { name: 'Bank Details' }).click();
        await page.getByPlaceholder('Account holder').fill(bankDetails.accountHolder);
        await page.getByPlaceholder('Account number').fill(bankDetails.accountNumber);
        await page.getByPlaceholder('IFSC').fill(bankDetails.ifsc);
        await page.getByPlaceholder('Bank name').fill(bankDetails.bankName);
        await page.getByPlaceholder('UPI ID').fill(bankDetails.upiId);
        await page.getByRole('button', { name: 'Save Bank Details' }).click();
        await expect(page.getByText('Bank details saved.')).toBeVisible();
        console.log('step: bank details updated');

        const salaryCardAfterBankJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_salary_card',
            { staff_id: hiredStaff.id }
        );
        expect(salaryCardAfterBankJson.data?.bank_details?.account_holder).toBe(bankDetails.accountHolder);
        expect(salaryCardAfterBankJson.data?.bank_details?.account_number).toBe(bankDetails.accountNumber);
        expect(salaryCardAfterBankJson.data?.bank_details?.ifsc).toBe(bankDetails.ifsc);
        expect(salaryCardAfterBankJson.data?.bank_details?.bank_name).toBe(bankDetails.bankName);
        expect(salaryCardAfterBankJson.data?.bank_details?.upi_id).toBe(bankDetails.upiId);

        await page.getByRole('button', { name: 'Edit Compensation' }).click();
        await page.getByPlaceholder('Base salary').fill(secondCompensation.baseSalary);
        await page.getByPlaceholder('Daily cleaning payout').fill(secondCompensation.dailyCleaning);
        await page.getByPlaceholder('Per-unit payout').fill(secondCompensation.perUnitPayout);
        await page.getByPlaceholder('Travel allowance').fill(secondCompensation.travelAllowance);
        await page.getByPlaceholder('Phone allowance').fill(secondCompensation.phoneAllowance);
        await page.getByPlaceholder('Weekly parking payout').fill(secondCompensation.weeklyParking);
        await page.getByPlaceholder('Complaint deduction').fill(secondCompensation.complaintDeduction);
        await page.getByRole('button', { name: 'Save Compensation' }).click();
        await expect(page.getByText('Compensation saved.')).toBeVisible();
        await expect(page.getByText('INR 27,800')).toBeVisible();
        await expect(page.getByTestId('hr-person-detail')).toContainText('Travel 1800 • Phone 900');
        await expect(page.getByTestId('hr-person-detail')).toContainText('Daily cleaning 240 • Parking 350 • Complaint deduction 260');
        console.log('step: compensation updated');

        const salaryCardAfterSecondCompJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_salary_card',
            { staff_id: hiredStaff.id }
        );
        expect(salaryCardAfterSecondCompJson.data?.base_salary).toBe(Number(secondCompensation.baseSalary));
        expect(salaryCardAfterSecondCompJson.data?.components?.incentives?.amount_per_unit).toBe(Number(secondCompensation.perUnitPayout));
        expect(salaryCardAfterSecondCompJson.data?.components?.allowances?.travel).toBe(Number(secondCompensation.travelAllowance));
        expect(salaryCardAfterSecondCompJson.data?.components?.allowances?.phone).toBe(Number(secondCompensation.phoneAllowance));
        expect(salaryCardAfterSecondCompJson.data?.components?.caretaker_rules?.daily_cleaning_proof_amount).toBe(Number(secondCompensation.dailyCleaning));
        expect(salaryCardAfterSecondCompJson.data?.components?.caretaker_rules?.weekly_parking_cleaning_amount).toBe(Number(secondCompensation.weeklyParking));
        expect(salaryCardAfterSecondCompJson.data?.components?.caretaker_rules?.maintenance_complaint_deduction).toBe(Number(secondCompensation.complaintDeduction));

        const crmLookupOldPhoneJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'CRMAgent',
            'get_lead_by_phone',
            { phone: initialPhone }
        );
        const crmLookupNewPhoneJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'CRMAgent',
            'get_lead_by_phone',
            { phone: updatedPhone }
        );
        expect(crmLookupOldPhoneJson.data?.status).toBe('Found');
        expect(crmLookupNewPhoneJson.data?.status).toBe('Found');
        expect(crmLookupNewPhoneJson.data?.lead?.email).toBe(updatedEmployeeEmail);
        expect(getLeadPrimaryPhone(crmLookupNewPhoneJson.data?.lead)).toBe(initialPhone);
        console.log(`step: crm old_phone=${crmLookupOldPhoneJson.data?.status || 'unknown'} new_phone=${crmLookupNewPhoneJson.data?.status || 'unknown'}`);

        await request.delete(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(updatedPhone)}`);
        const updatedWhatsappSend = await request.post(`${apiBaseUrl}/api/simulator/whatsapp/send`, {
            data: {
                from: updatedPhone,
                body: `HR GUI QA updated ping ${stamp}`,
            },
        });
        expect(updatedWhatsappSend.ok()).toBeTruthy();
        const updatedWhatsappThread = await request.get(`${apiBaseUrl}/api/simulator/whatsapp/thread?phone=${encodeURIComponent(updatedPhone)}`);
        expect(updatedWhatsappThread.ok()).toBeTruthy();
        const updatedWhatsappThreadJson = await updatedWhatsappThread.json();
        expect(updatedWhatsappThreadJson.success).toBeTruthy();
        expect(Array.isArray(updatedWhatsappThreadJson.data?.items)).toBeTruthy();
        expect(updatedWhatsappThreadJson.data.items.length).toBeGreaterThanOrEqual(2);
        console.log(`step: whatsapp updated_phone_items=${updatedWhatsappThreadJson.data.items.length}`);

        await page.getByRole('button', { name: 'Terminate' }).click();
        await page.getByPlaceholder('Reason for termination').fill(`QA termination ${stamp}`);
        await page.locator('input[type="date"]').fill('2026-03-11');
        await page.getByRole('button', { name: 'Confirm Termination' }).click();
        await expect(page.getByPlaceholder('Reason for termination')).toHaveCount(0);

        await page.getByPlaceholder('Search people').fill(updatedName);
        await expect(page.locator('[data-testid="hr-people-roster"]')).not.toContainText(updatedName);
        await page.getByRole('combobox').selectOption('TERMINATED');
        await expect(page.locator('[data-testid="hr-people-roster"]')).toContainText(updatedName);
        console.log('step: termination visibility validated');

        const staffAfterTerminationJson = await executeTool(
            request,
            apiBaseUrl,
            tenantId,
            ceoEmail,
            'HRAgent',
            'get_all_staff',
            {}
        );
        const terminatedStaff = Array.isArray(staffAfterTerminationJson.data)
            ? staffAfterTerminationJson.data.find((person) => person.id === hiredStaff.id)
            : null;
        expect(terminatedStaff?.status).toBe('TERMINATED');
        expect(terminatedStaff?.last_working_day).toBe('2026-03-11');

        test.info().annotations.push(
            { type: 'tenant_id', description: String(tenantId) },
            { type: 'initial_phone', description: initialPhone },
            { type: 'updated_phone', description: updatedPhone },
            { type: 'crm_old_phone_status', description: String(crmLookupOldPhoneJson.data?.status || 'unknown') },
            { type: 'crm_new_phone_status', description: String(crmLookupNewPhoneJson.data?.status || 'unknown') },
            { type: 'whatsapp_items', description: String(whatsappThreadJson.data?.items?.length || 0) },
            { type: 'updated_whatsapp_items', description: String(updatedWhatsappThreadJson.data?.items?.length || 0) },
        );
    });
});
