const PropertyAI = require('../../../server/src/agents/PropertyAI');

describe('PropertyAI: Maintenance Tools', () => {
    let agent;
    let propertyId;
    let unitId;

    beforeEach(async () => {
        agent = new PropertyAI();
        const prop = await agent.callTool('add_property', {
            name: 'MaintBlock',
            address: 'City',
            amenities: []
        });
        propertyId = prop.property_id;

        const unit = await agent.callTool('add_unit', {
            property_id: propertyId,
            unit_number: 'M-01'
        });
        unitId = unit.unit_id;
    });

    test('Log Maintenance Request', async () => {
        const res = await agent.callTool('log_maintenance_req', {
            property_id: propertyId,
            unit_id: unitId,
            category: 'PLUMBING',
            description: 'Leaking tap',
            priority: 'MEDIUM',
            reported_by: 'Tenant-01'
        });

        expect(res.status).toBe('Ticket Logged');
        expect(res.ticket_id).toBeDefined();

        const tickets = await agent.callTool('get_maintenance_reqs', { unit_id: unitId });
        expect(tickets.length).toBe(1);
        expect(tickets[0].status).toBe('OPEN');
        expect(tickets[0].description).toBe('Leaking tap');
    });

    test('Update Maintenance Request', async () => {
        const log = await agent.callTool('log_maintenance_req', {
            property_id: propertyId,
            unit_id: unitId,
            category: 'ELECTRICAL',
            description: 'Light broken',
            priority: 'HIGH',
            reported_by: 'Tenant-01'
        });

        const res = await agent.callTool('update_maintenance_req', {
            ticket_id: log.ticket_id,
            status: 'IN_PROGRESS',
            remarks: 'Electrician assigned',
            cost: 500
        });

        expect(res.current_status).toBe('IN_PROGRESS');

        const ticket = (await agent.callTool('get_maintenance_reqs', {}))[0];
        expect(ticket.status).toBe('IN_PROGRESS');
        expect(ticket.remarks.length).toBe(1);
        expect(ticket.remarks[0].text).toBe('Electrician assigned');
        expect(ticket.cost).toBe(500);
    });

    test('Filter Maintenance Requests', async () => {
        await agent.callTool('log_maintenance_req', {
            property_id: propertyId,
            unit_id: unitId,
            category: 'PLUMBING',
            description: 'Problem 1',
            priority: 'LOW',
            reported_by: 'T1'
        }); // Status OPEN

        const log2 = await agent.callTool('log_maintenance_req', {
            property_id: propertyId,
            unit_id: unitId,
            category: 'ELECTRICAL',
            description: 'Problem 2',
            priority: 'MEDIUM',
            reported_by: 'T1'
        });

        await agent.callTool('update_maintenance_req', {
            ticket_id: log2.ticket_id,
            status: 'RESOLVED'
        });

        const openTickets = await agent.callTool('get_maintenance_reqs', { status: 'OPEN' });
        expect(openTickets.length).toBe(1);
        expect(openTickets[0].description).toBe('Problem 1');

        const resolvedTickets = await agent.callTool('get_maintenance_reqs', { status: 'RESOLVED' });
        expect(resolvedTickets.length).toBe(1);
        expect(resolvedTickets[0].description).toBe('Problem 2');
    });
});
