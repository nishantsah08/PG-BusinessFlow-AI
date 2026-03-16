const FinanceAI = require('../src/agents/FinanceAI');

describe('FinanceAI booking hold and vendor flows', () => {
    let financeAI;
    const tenantId = 'tenant_finance_booking_vendor';

    beforeEach(() => {
        jest.resetModules();
        process.env.STORAGE_BACKEND = 'memory';
        financeAI = new FinanceAI();
    });

    it('records booking hold, applies it on onboarding date, and generates prorated bill for the target billing month', async () => {
        const bookingHold = await financeAI.callTool('record_booking_hold', {
            tenant_id: tenantId,
            payer_id: '+919800001111',
            amount: 5000,
            payment_mode: 'UPI',
            received_at: '2026-03-05',
            linked_property_id: 'PROP-1',
            linked_unit_id: 'UNIT-1',
        });

        expect(bookingHold.status).toBe('SUCCESS');
        expect(bookingHold.valid_until).toBe('2026-03-15');

        const onboarding = await financeAI.callTool('complete_onboarding_from_booking', {
            tenant_id: tenantId,
            booking_hold_id: bookingHold.booking_hold_id,
            lead_id: '+919800001111',
            unit_id: 'UNIT-9',
            property_id: 'PROP-1',
            onboarding_date: '2026-03-21',
            negotiated_rent: 12000,
            security_deposit: 5000,
            rent_payment_timing: 'ADVANCE',
            utility_payment_timing: 'ARREARS',
        });

        expect(onboarding.status).toBe('SUCCESS');

        const bookingHolds = await financeAI.callTool('get_booking_holds', {
            tenant_id: tenantId,
            payer_id: '+919800001111',
        });
        expect(bookingHolds.booking_holds[0].status).toBe('APPLIED_ON_ONBOARDING');
        expect(bookingHolds.booking_holds[0].applied_on).toBe('2026-03-21');
        expect(bookingHolds.booking_holds[0].linked_unit_id).toBe('UNIT-9');

        const bill = await financeAI.callTool('generate_monthly_bills', {
            tenant_id: tenantId,
            payer_id: '+919800001111',
            month_year: 'Mar 2026',
        });

        expect(bill.status).toBe('SUCCESS');
        expect(bill.generated_entries).toHaveLength(1);
        expect(bill.applied_carry_forward.amount).toBe(Math.round((12000 * 11) / 31));

        const ledger = await financeAI.callTool('get_ledger', {
            tenant_id: tenantId,
            payer_id: '+919800001111',
        });
        expect(ledger.entries).toHaveLength(1);
        expect(ledger.entries[0].amount_due).toBe(Math.round((12000 * 11) / 31));
        expect(ledger.entries[0].charge_window).toEqual({
            from: '2026-03-21',
            to: '2026-03-31',
            days_active: 11,
            days_in_month: 31,
        });
        expect(ledger.entries[0].amount_paid).toBe(Math.round((12000 * 11) / 31));
        expect(ledger.entries[0].balance).toBe(0);
    });

    it('tracks multi-vendor work context, installments, and vendor balances from outgoing transactions', async () => {
        const vendorPrime = await financeAI.callTool('add_vendor', {
            tenant_id: tenantId,
            vendor_name: 'Vendor Prime',
            category: 'Maintenance',
            primary_phone: '+919811110000',
            upi_id: 'vendorprime@upi',
        });

        const vendorAssist = await financeAI.callTool('add_vendor', {
            tenant_id: tenantId,
            vendor_name: 'Vendor Assist',
            category: 'Maintenance',
            primary_phone: '+919822220000',
            upi_id: 'vendorassist@upi',
        });

        expect(vendorPrime.status).toBe('SUCCESS');
        expect(vendorAssist.status).toBe('SUCCESS');

        const firstOutgoing = await financeAI.callTool('record_outgoing_txn', {
            tenant_id: tenantId,
            property_id: 'PROP-1',
            unit_id: 'UNIT-9',
            category: 'OpEx',
            sub_category: 'Plumbing',
            work_title: 'Unit 9 Plumbing Repair',
            work_done: 'Washroom repair',
            line_items: [
                { item_name: 'PVC Pipe', quantity: 2, unit_price: 900 },
                { item_name: 'Labour Visit', quantity: 1, unit_price: 1200 },
            ],
            amount: 2000,
            vendor_id: vendorPrime.vendor_id,
            payment_mode: 'UPI',
            date: '2026-03-12',
        });

        expect(firstOutgoing.status).toBe('SUCCESS');
        expect(firstOutgoing.work_order_mode).toBe('created');
        expect(firstOutgoing.vendor_balance_after_payment).toBe(1000);

        const secondOutgoing = await financeAI.callTool('record_outgoing_txn', {
            tenant_id: tenantId,
            property_id: 'PROP-1',
            work_order_id: firstOutgoing.work_order_id,
            category: 'OpEx',
            amount: 1000,
            vendor_id: vendorPrime.vendor_id,
            payment_mode: 'UPI',
            date: '2026-03-13',
        });

        expect(secondOutgoing.status).toBe('SUCCESS');
        expect(secondOutgoing.payment_only).toBe(true);
        expect(secondOutgoing.work_order_mode).toBe('existing');
        expect(secondOutgoing.vendor_balance_after_payment).toBe(0);

        const thirdOutgoing = await financeAI.callTool('record_outgoing_txn', {
            tenant_id: tenantId,
            property_id: 'PROP-1',
            work_order_id: firstOutgoing.work_order_id,
            category: 'OpEx',
            work_done: 'Extra valve and sealant',
            line_items: [
                { item_name: 'Valve', quantity: 1, unit_price: 900 },
                { item_name: 'Sealant', quantity: 2, unit_price: 300 },
            ],
            amount: 500,
            vendor_id: vendorAssist.vendor_id,
            payment_mode: 'UPI',
            date: '2026-03-14',
        });

        expect(thirdOutgoing.status).toBe('SUCCESS');
        expect(thirdOutgoing.work_order_id).toBe(firstOutgoing.work_order_id);
        expect(thirdOutgoing.vendor_balance_after_payment).toBe(1000);

        const workOrders = await financeAI.callTool('get_work_orders', {
            tenant_id: tenantId,
            property_id: 'PROP-1',
        });
        expect(workOrders.work_orders).toHaveLength(1);
        expect(workOrders.work_orders[0].vendor_count).toBe(2);
        expect(workOrders.work_orders[0].payment_count).toBe(3);

        const vendorSummary = await financeAI.callTool('get_vendor_summary', {
            tenant_id: tenantId,
            vendor_id: vendorPrime.vendor_id,
        });

        expect(vendorSummary.status).toBe('SUCCESS');
        expect(vendorSummary.vendor.vendor_name).toBe('Vendor Prime');
        expect(vendorSummary.vendor.total_paid).toBe(3000);
        expect(vendorSummary.vendor.transaction_count).toBe(2);
        expect(vendorSummary.vendor.open_balance).toBe(0);
        expect(vendorSummary.vendor.recent_transactions[0].payee).toBe('Vendor Prime');

        const vendorAssistSummary = await financeAI.callTool('get_vendor_summary', {
            tenant_id: tenantId,
            vendor_id: vendorAssist.vendor_id,
        });
        expect(vendorAssistSummary.status).toBe('SUCCESS');
        expect(vendorAssistSummary.vendor.total_paid).toBe(500);
        expect(vendorAssistSummary.vendor.open_balance).toBe(1000);
    });
});
