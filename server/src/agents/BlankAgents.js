const BaseAgent = require('./BaseAgent');

// --- Sub-Agents ---

class BillingAgent extends BaseAgent {
    constructor() {
        super({
            name: 'BillingAgent',
            identity: {
                role: 'Billing Sub-Agent',
                description: 'Receives finalized rate card. Bill generated on LAST day of month. Logic: Rent (Pro-rata), Electricity ((Total bill/Total person-days)*Tenant person-days), Items (Rent, Elec, WiFi, Parking, Fines, Police Verif, Pending). Rules: Due date per customer, Late fine ₹20/day max 5 days. Pending: Carried forward to next month.'
            },
            capabilities: {
                skills: ['Billing', 'Pro-rata Math', 'Fine Calculation'],
                tools: ['generate_bill', 'apply_late_fine']
            },
            directives: {
                goals: ['Accurate billing based on usage', 'Strict adherence to Rate Card'],
                constraints: ['Bill generation only on last day of month', 'Electricity rate fixed at ₹10/unit']
            }
        });
    }
}

class AccountingAgent extends BaseAgent {
    constructor() {
        super({
            name: 'AccountingAgent',
            identity: {
                role: 'Accounting Sub-Agent',
                description: 'Maintains the immutable ledger of Incoming (linked to Unit ID) and Outgoing (CapEx/OpEx) transactions.'
            },
            capabilities: {
                skills: ['Ledger Management', 'Auditing', 'Transaction Classification'],
                tools: ['record_transaction', 'generate_audit_report']
            },
            directives: {
                goals: ['100% Auditability', 'Maintain Immutable Ledger'],
                constraints: ['Ledger is strictly append-only (immutable)']
            }
        });
    }
}

class SalaryAgent extends BaseAgent {
    constructor() {
        super({
            name: 'SalaryAgent',
            identity: {
                role: 'Salary Sub-Agent',
                description: 'Calculates salary and advances based on the Salary Card defined by HR.'
            },
            capabilities: {
                skills: ['Payroll Management', 'Advance Tracking'],
                tools: ['calculate_payout', 'track_advance']
            },
            directives: {
                goals: ['Timely salary processing'],
                constraints: ['Cannot modify salary cards (HR source of truth)']
            }
        });
    }
}

class WhatsAppAgent extends BaseAgent {
    constructor() {
        super({
            name: 'WhatsAppAgent',
            identity: {
                role: 'WhatsApp Sub-Agent',
                description: 'Sends tone-aware WhatsApp messages. Primary interaction channel for leads and tenants.'
            },
            capabilities: {
                skills: ['Messaging', 'Tone Analysis'],
                tools: ['send_whatsapp']
            },
            directives: {
                goals: ['Instant response', 'High engagement'],
                constraints: ['Zero spam policy', 'Maintain professional tone']
            }
        });
    }
}

class EmailAgent extends BaseAgent {
    constructor() {
        super({
            name: 'EmailAgent',
            identity: {
                role: 'Email Sub-Agent',
                description: 'Sends formal email correspondence (contracts, formal notices).'
            },
            capabilities: {
                skills: ['Formal Correspondence', 'Contract Handling'],
                tools: ['send_email']
            },
            directives: {
                goals: ['Official communication flow'],
                constraints: []
            }
        });
    }
}

class SIPTrunkAgent extends BaseAgent {
    constructor() {
        super({
            name: 'SIPTrunkAgent',
            identity: {
                role: 'SIP Sub-Agent',
                description: 'Handles voice calls and IVR routing.'
            },
            capabilities: {
                skills: ['Voice Routing', 'SIP Integration'],
                tools: ['dial_number', 'record_call']
            },
            directives: {
                goals: ['Reliable voice channel'],
                constraints: []
            }
        });
    }
}

// --- Main Agents ---

class PropertyAI extends BaseAgent {
    constructor() {
        super({
            name: 'PropertyAI',
            identity: {
                role: 'Inventory & Asset Manager',
                description: 'Manages physical assets (Buildings, Units). Hierarchy: Property -> Unit -> (Bed / Bedroom / Flat). Source of truth for availability and Market rates. Statuses: Booked, Not Booked, Notice Given.'
            },
            capabilities: {
                skills: ['Inventory Lifecycle Management', 'Rate Card Management', 'Availability Intelligence'],
                tools: [
                    'list_properties', 'add_property', 'delete_property',
                    'add_unit', 'delete_unit', 'update_unit_status',
                    'check_availability', 'update_rate_card'
                ]
            },
            directives: {
                goals: ['100% Inventory Accuracy', 'Optimal Utilization'],
                constraints: [
                    'Safe Deletion: No deletion without high confidence or discussion',
                    'Inheritance: Property-level features (WiFi, Parking) inherited by units',
                    'Definitive source for current and future (Notice Given) availability'
                ]
            }
        });

        // Register all defined tools
        this.registerTool('list_properties', 'List all properties', { type: 'object', properties: {} }, async () => {
            return [{ id: "prop_1", name: "Sunshine PG", buildings: 1 }];
        });

        this.registerTool('add_property', 'Add a new property', {
            type: 'object',
            properties: { name: { type: 'string' }, location: { type: 'string' } },
            required: ['name']
        }, async ({ name }) => {
            return { status: "Property Added", id: "prop_new", name };
        });

        this.registerTool('delete_property', 'Delete a property', {
            type: 'object',
            properties: { propertyId: { type: 'string' } },
            required: ['propertyId']
        }, async ({ propertyId }) => {
            return { status: "Property Marked for Deletion", propertyId };
        });

        this.registerTool('add_unit', 'Add a unit to a property', {
            type: 'object',
            properties: { propertyId: { type: 'string' }, unitName: { type: 'string' } },
            required: ['propertyId', 'unitName']
        }, async ({ unitName }) => {
            return { status: "Unit Added", id: "unit_new", unitName };
        });

        this.registerTool('delete_unit', 'Delete a unit', {
            type: 'object',
            properties: { unitId: { type: 'string' } },
            required: ['unitId']
        }, async ({ unitId }) => {
            return { status: "Unit Removed", unitId };
        });

        this.registerTool('update_unit_status', 'Update unit status (Booked, Not Booked, Notice Given)', {
            type: 'object',
            properties: { unitId: { type: 'string' }, status: { type: 'string', enum: ['Booked', 'Not Booked', 'Notice Given'] } },
            required: ['unitId', 'status']
        }, async ({ status }) => {
            return { status: "Status Updated", newStatus: status };
        });

        this.registerTool('check_availability', 'Check availability for current or future dates', {
            type: 'object',
            properties: { date: { type: 'string' } }
        }, async () => {
            return { availableUnits: 5, pendingNotice: 2 };
        });

        this.registerTool('update_rate_card', 'Update rate card for a unit', {
            type: 'object',
            properties: { unitId: { type: 'string' }, rent: { type: 'number' } },
            required: ['unitId', 'rent']
        }, async ({ rent }) => {
            return { status: "Rate Card Updated", newRent: rent };
        });
    }
}

class CRMAgent extends BaseAgent {
    constructor() {
        super({
            name: 'CRMAgent',
            identity: {
                role: 'Lead Manager',
                description: 'Record Every Lead (Name, Phone, Info). Interaction Logging (WhatsApp, Phone). Storage: Links to audio/transcripts in GCS, Summary, Sentiment, Behavior. Update lead snapshot after every touchpoint.'
            },
            capabilities: {
                skills: ['Lead Lifecycle Tracking', 'Sentiment Analysis', 'Interaction Analysis'],
                tools: ['add_lead', 'log_interaction', 'get_lead_snapshot']
            },
            directives: {
                goals: ['Zero lead leakage', 'Deep behavioral context'],
                constraints: ['Privacy: NO raw audio bytes storage, only GCS links']
            }
        });

        this.registerTool('add_lead', 'Record a new lead', {
            type: 'object',
            properties: { name: { type: 'string' }, phone: { type: 'string' } },
            required: ['name', 'phone']
        }, async ({ name }) => {
            return { status: "Lead Saved", name };
        });
    }
}

class HRAgent extends BaseAgent {
    constructor() {
        super({
            name: 'HRAgent',
            identity: {
                role: 'Staff Manager',
                description: 'Manages staff lifecycle (Hiring/Firing) and defines Salary Cards (agreements).'
            },
            capabilities: {
                skills: ['Lifecycle Management', 'Compensation Structuring'],
                tools: ['get_staff_count', 'create_salary_card', 'terminate_staff']
            },
            directives: {
                goals: ['Maintain up-to-date staff roster', 'Accurate salary agreements'],
                constraints: ['Handover Salary Card to Finance for payment; no direct disbursement']
            }
        });

        this.registerTool('create_salary_card', 'Define salary agreement for staff', {
            type: 'object',
            properties: { staffId: { type: 'string' }, basic: { type: 'number' } },
            required: ['staffId', 'basic']
        }, async () => {
            return { status: "Salary Card Created and Sent to Finance" };
        });
    }
}

class FinanceAI extends BaseAgent {
    constructor() {
        const billing = new BillingAgent();
        const accounting = new AccountingAgent();
        const salary = new SalaryAgent();

        super({
            name: 'FinanceAI',
            identity: {
                role: 'Chief Financial Officer',
                description: 'Orchestrates Billing, Accounting, and Salaries. Ensures accurate ledger and timely dues collection.'
            },
            capabilities: {
                skills: ['Financial Oversight', 'Auditing', 'Cash Flow Management'],
                tools: ['get_financial_summary']
            },
            directives: {
                goals: ['Collect 100% dues', 'Maintain audit-ready ledger'],
                constraints: ['Enforce Rate Cards strictly']
            },
            hierarchy: {
                subAgents: [billing, accounting, salary]
            }
        });
    }
}

class CommunicationsAI extends BaseAgent {
    constructor() {
        const whatsapp = new WhatsAppAgent();
        const email = new EmailAgent();
        const sip = new SIPTrunkAgent();

        super({
            name: 'CommunicationsAI',
            identity: {
                role: 'Communications Gateway',
                description: 'Sends/Receives all external communications. On receive → Relay event to Master AI.'
            },
            capabilities: {
                skills: ['Multi-channel Communication', 'Event Relaying'],
                tools: ['relay_event']
            },
            directives: {
                goals: ['Zero message loss', 'Instant relay to Master AI'],
                constraints: ['Relay only; no decision-making power']
            },
            hierarchy: {
                subAgents: [whatsapp, email, sip]
            }
        });
    }
}

module.exports = { PropertyAI, CRMAgent, HRAgent, FinanceAI, CommunicationsAI };
