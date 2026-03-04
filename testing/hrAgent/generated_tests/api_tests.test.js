const HRAgent = require('../../../server/src/agents/HRAgent');

describe('HR Agent API Tests (Layer 4)', () => {
    let hrAgent;

    beforeEach(() => {
        hrAgent = new HRAgent();
    });

    test('API: Missing Required Fields (Hire)', async () => {
        await expect(hrAgent.callTool('hire_staff', {
            name: "No Contact"
            // Missing designation and contact
        })).rejects.toThrow();
    });

    test('API: Missing Required Fields (Salary Card)', async () => {
        const hire = await hrAgent.callTool('hire_staff', { name: "Test", designation: "Test", contact: { primary: "000" } });
        await expect(hrAgent.callTool('create_salary_card', {
            staff_id: hire.staff_id,
            // Missing base_salary and bank_details
        })).rejects.toThrow();
    });

    test('API: Invalid Staff ID (Get Details)', async () => {
        const result = await hrAgent.callTool('get_staff_details', { staff_id: "INVALID-ID" });
        expect(result).toHaveProperty('error');
    });

    test('API: Invalid Staff ID (Terminate)', async () => {
        await expect(hrAgent.callTool('terminate_staff', {
            staff_id: "NON-EXISTENT",
            reason: "Test"
        })).rejects.toThrow();
    });

    test('API: Invalid Enum Value (Leave Type)', async () => {
        const hire = await hrAgent.callTool('hire_staff', { name: "Test", designation: "Test", contact: { primary: "001" } });
        await expect(hrAgent.callTool('record_leave', {
            staff_id: hire.staff_id,
            leave_type: "INVALID_TYPE", // Should fail enum validation if strictly enforced, or logic error
            start_date: "2024-01-01"
        })).rejects.toThrow();
    });
});
