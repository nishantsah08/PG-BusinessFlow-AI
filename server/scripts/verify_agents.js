const PropertyAI = require('../src/agents/PropertyAI');
const CRMAgent = require('../src/agents/CRMAgent');
const HRAgent = require('../src/agents/HRAgent');
const FinanceAI = require('../src/agents/FinanceAI');
const CommunicationsAI = require('../src/agents/CommunicationsAI');

async function runVerification() {
    console.log("=== Starting Phase 1 Verification ===");

    // 1. Property AI
    console.log("\n--- Property AI Verification ---");
    const propertyAI = new PropertyAI();

    const rates = await propertyAI.callTool('get_public_rate_card', {});
    console.log("Rates MRP:", rates.monthly_rent);

    const depositRegular = await propertyAI.callTool('calculate_deposit', { monthly_rent: 12000, start_date: '2024-03-02' });
    console.log("Deposit (2nd):", depositRegular.total_deposit, "(Expected 2500)");

    const depositDynamic = await propertyAI.callTool('calculate_deposit', { monthly_rent: 12000, start_date: '2024-03-07' });
    console.log("Deposit (7th):", depositDynamic.total_deposit, "(Expected > 2500)");

    const prop = await propertyAI.callTool('add_property', { name: "PG One", address: "Sector 1", description: "Nice Place" });
    console.log("Property Created:", prop.property_id);

    const unit = await propertyAI.callTool('add_unit', { property_id: prop.property_id, unit_number: "101", floor: 1 });
    console.log("Unit Created:", unit.unit_id);

    // 2. CRM Agent
    console.log("\n--- CRM Agent Verification ---");
    const crm = new CRMAgent();
    const lead = await crm.callTool('add_lead', { name: "John Doe", primary_phone: "+919999999999", source: "WhatsApp" });
    console.log("Lead Created:", lead.lead_id);

    await crm.callTool('log_interaction', { lead_id: lead.lead_id, interaction_type: "Call", summary: "Inquired about rent", sentiment: "Positive" });
    console.log("Interaction Logged");

    // 3. HR & Finance
    console.log("\n--- HR & Finance Verification ---");
    const hr = new HRAgent();
    const finance = new FinanceAI();

    // HR Setup
    const staff = await hr.callTool('hire_staff', { name: "Ramesh", designation: "Manager", staff_id: "STF-MAN-1" });
    await hr.callTool('create_salary_card', { staff_id: staff.staff_id, base_salary: 20000 });
    console.log("Staff Hired & Salary Card Created");

    // Finance - Bill Generation
    // Create Bill for a Dummy User "USER-123"
    // Items: Security (2500), Rent (12000)
    await finance.callTool('generate_monthly_bills', {
        payer_id: "USER-123",
        month_year: "March 2024",
        items: [
            { category: "Rent", amount: 12000 },
            { category: "Security Deposit", amount: 2500 }
        ]
    });
    console.log("Bill Generated for USER-123: Rent(12k) + Security(2.5k)");

    // Finance - Waterfall Payment
    // Pay 3000. Should clear Security (2500) and partial Rent (500).
    const payment = await finance.callTool('record_incoming_txn', {
        payer_id: "USER-123",
        amount: 3000,
        mode: "UPI"
    });

    console.log("Payment of 3000 Recorded.");
    console.log("Allocations:", JSON.stringify(payment.allocations, null, 2));

    const pSec = payment.allocations.find(a => a.category === 'Security Deposit');
    const pRent = payment.allocations.find(a => a.category === 'Rent');

    if (pSec && pSec.amount_allocated === 2500 && pRent && pRent.amount_allocated === 500) {
        console.log("SUCCESS: Waterfall Logic Verified!");
    } else {
        console.error("FAILURE: Waterfall Logic Incorrect", payment.allocations);
    }

    // 4. Communications AI (Meta WhatsApp)
    console.log("\n--- Communications AI (WhatsApp Meta) ---");
    const comms = new CommunicationsAI();
    // We will try to send to a dummy number. Meta Cloud API will likely reject it or return an error if not in 'To' list for test apps.
    // If it's a live app, it might try to send. 
    // We use a clearly fake number to avoid spamming real people, but formatted correctly for the API check.
    // Meta requires country code. +91 99999 99999

    // NOTE: This call might fail with "Recipient not registered" if using a Test Account token, 
    // or fail because the number doesn't exist. We just want to see the "Meta API Error" or "Success".
    const msgResult = await comms.callTool('send_message', {
        channel: 'WhatsApp',
        recipient: '919999999999',
        content: 'Verification Ping',
        tone: 'Casual'
    });
    console.log("Msg Result:", msgResult);

    console.log("\n=== Verification Complete ===");
}

runVerification();
