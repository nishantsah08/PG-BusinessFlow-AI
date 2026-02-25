const HRAgent = require('../../../server/src/agents/HRAgent');

describe('HR Agent: CRM Sync Logic (Event-Driven)', () => {
    let hrAgent;

    beforeEach(() => {
        hrAgent = new HRAgent();
    });

    test('hire_staff emits staff.hired event', async () => {
        const hireArgs = {
            name: "New Staff",
            designation: "Guard",
            contact: { primary: "+911234567890", email: "test@test.com" },
            base_salary: 10000
        };

        const eventSpy = jest.fn();
        hrAgent.on('staff.hired', eventSpy);

        await hrAgent.callTool('hire_staff', hireArgs);

        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
            name: "New Staff",
            designation: "Guard",
            contact: expect.objectContaining({ primary: "+911234567890" }),
            staff_id: expect.stringMatching(/^STF-\d+$/)
        }));
    });
});
