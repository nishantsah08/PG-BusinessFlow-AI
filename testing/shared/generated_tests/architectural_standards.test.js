
const CommunicationsAI = require('../../../server/src/agents/CommunicationsAI');
const PropertyAI = require('../../../server/src/agents/PropertyAI');
const CRMAgent = require('../../../server/src/agents/CRMAgent');

// Mock Axios for CommunicationsAI (it's used internally)
jest.mock('axios');

describe('Architectural Invariants (ADR-001)', () => {

    // --- 1. Unified Timeout (60s) ---
    describe('Global Unified Timeout', () => {
        let commsAI;
        beforeEach(() => {
            commsAI = new CommunicationsAI();
        });

        test('CommunicationsAI: handle_incoming_message should return ttl_ms: 60000', async () => {
            // Mock payload structure (minimal valid webhook)
            const payload = {
                object: 'whatsapp_business_account',
                entry: [{
                    changes: [{
                        value: {
                            messages: [{
                                from: '1234567890',
                                id: 'wamid.HBgLM',
                                timestamp: Math.floor(Date.now() / 1000),
                                text: { body: 'Hello' },
                                type: 'text'
                            }]
                        }
                    }]
                }]
            };

            const event = await commsAI.callTool('handle_incoming_message', { payload });
            expect(event).toBeDefined();
            expect(event.routing).toBeDefined();
            expect(event.routing.ttl_ms).toBe(60000); // 60s
        });

        test('CommunicationsAI: handle_delivery_status should return ttl_ms: 60000', async () => {
            // Mock payload structure (minimal valid status)
            const payload = {
                object: 'whatsapp_business_account',
                entry: [{
                    changes: [{
                        value: {
                            statuses: [{
                                id: 'wamid.HBgLM',
                                status: 'delivered',
                                recipient_id: '1234567890',
                                timestamp: Math.floor(Date.now() / 1000)
                            }]
                        }
                    }]
                }]
            };

            const event = await commsAI.callTool('handle_delivery_status', { payload });
            expect(event).toBeDefined();
            expect(event.routing).toBeDefined();
            expect(event.routing.ttl_ms).toBe(60000); // 60s
        });
    });

    // --- 2. PropertyAI Status Enums (Uppercase) ---
    describe('PropertyAI Status Enums', () => {
        let propertyAI;
        beforeEach(() => {
            propertyAI = new PropertyAI();
            // Seed a property and unit
            propertyAI.properties.push({ id: 'P1', name: 'TestProp', status: 'ACTIVE', amenities: [] });
            propertyAI.units.push({
                id: 'U1', property_id: 'P1', unit_number: '101', status: 'AVAILABLE', history: [], amenities: []
            });
        });

        test('Should accept uppercase status AVAILABLE', async () => {
            // Move to BOOKED then back to AVAILABLE (via NOTICE usually, but let's check validation logic strings)
            // Logic allows NOTICE -> AVAILABLE.
            // Let's set it to NOTICE first manually to test transition.
            const unit = propertyAI.units.find(u => u.id === 'U1');
            unit.status = 'NOTICE';

            const result = await propertyAI.callTool('update_unit', { unit_id: 'U1', status: 'AVAILABLE' });
            expect(result.current_status).toBe('AVAILABLE');
        });

        test('Should fail for lowercase status "available"', async () => {
            const unit = propertyAI.units.find(u => u.id === 'U1');
            unit.status = 'NOTICE';

            await expect(propertyAI.callTool('update_unit', {
                unit_id: 'U1', status: 'available'
            })).rejects.toThrow();
        });


        test('Should fail for mixed case status "Booked"', async () => {
            await expect(propertyAI.callTool('update_unit', {
                unit_id: 'U1', status: 'Booked', tenant_id: '123'
            })).rejects.toThrow();
        });
    });

    // --- 3. CRM Persistence (Mutable Snapshot / Append-Only Log) ---
    describe('CRM Persistence Model', () => {
        let crmAgent;
        beforeEach(async () => {
            crmAgent = new CRMAgent();
            await crmAgent.callTool('add_lead', { name: "Test User", primary_phone: "9999999999" });
        });

        test('Snapshot should be MUTABLE (update in-place)', async () => {
            // Initial state
            const leadBefore = await crmAgent.callTool('get_lead_by_phone', { phone: "9999999999" });
            expect(leadBefore.lead.profile_type).toBe('Customer');

            // Update
            await crmAgent.callTool('update_lead_snapshot', { lead_id: "9999999999", profile_type: 'Staff' });

            // Check state (same lead_id, changed property)
            const leadAfter = await crmAgent.callTool('get_lead_by_phone', { phone: "9999999999" });
            expect(leadAfter.lead.profile_type).toBe('Staff');
            // Ensure it's the same object reference in memory (simulated)
            expect(leadAfter.lead).toBe(crmAgent.leads.get("9999999999"));
        });

        test('Timeline should be APPEND-ONLY', async () => {
            // Log an event
            await crmAgent.callTool('log_session', { lead_id: "9999999999", summary: "Session 1" });

            const timeline1 = await crmAgent.callTool('get_timeline', { lead_id: "9999999999" });
            const count1 = timeline1.events.length;

            // Log another event
            await crmAgent.callTool('log_session', { lead_id: "9999999999", summary: "Session 2" });

            const timeline2 = await crmAgent.callTool('get_timeline', { lead_id: "9999999999" });
            const count2 = timeline2.events.length;

            expect(count2).toBeGreaterThan(count1);
            // Verify previous event is still there and unchanged
            expect(timeline2.events).toEqual(expect.arrayContaining(timeline1.events));
        });
    });

});
