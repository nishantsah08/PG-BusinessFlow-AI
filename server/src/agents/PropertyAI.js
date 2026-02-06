const BaseAgent = require('./BaseAgent');

class PropertyAI extends BaseAgent {
    constructor() {
        super({
            name: 'PropertyAI',
            identity: {
                role: 'Inventory & Asset Manager',
                description: 'Responsible for managing all physical assets (Properties, Units) and their current status.'
            },
            capabilities: {
                skills: ['Asset Management', 'Rate Calculation'],
                tools: ['add_property', 'add_unit', 'add_meter', 'calculate_deposit', 'get_public_rate_card']
            },
            directives: {
                goals: ['Ensure no double bookings', 'Maintain accurate inventory'],
                constraints: ['Logical deletes only']
            }
        });

        // In-memory storage for Phase 1
        this.properties = [];
        this.units = [];
        this.meters = [];

        this.registerTools();
    }

    registerTools() {
        // add_property
        this.registerTool('add_property', 'Add a new property building', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                address: { type: 'string' },
                description: { type: 'string' },
                image_urls: { type: 'array', items: { type: 'string' } },
                amenities: { type: 'array', items: { type: 'string' } },
                floors: { type: 'number' }
            },
            required: ['name', 'address']
        }, async (args) => {
            const property = {
                id: `PROP-${this.properties.length + 1}`,
                ...args,
                created_at: new Date().toISOString()
            };
            this.properties.push(property);
            return { status: "Property Added", property_id: property.id };
        });

        // add_unit
        this.registerTool('add_unit', 'Add a unit to a property', {
            type: 'object',
            properties: {
                property_id: { type: 'string' },
                unit_number: { type: 'string' },
                floor: { type: 'number' },
                amenities: { type: 'array', items: { type: 'string' } }
            },
            required: ['property_id', 'unit_number']
        }, async (args) => {
            // Basic validation
            const propExists = this.properties.find(p => p.id === args.property_id);
            if (!propExists) throw new Error("Property ID not found");

            const unit = {
                id: `UNIT-${this.units.length + 1}`,
                ...args,
                status: 'AVAILABLE',
                amenities: args.amenities || propExists.amenities || [] // Inherit if not provided
            };
            this.units.push(unit);
            return { status: "Unit Added", unit_id: unit.id };
        });

        // add_meter
        this.registerTool('add_meter', 'Add an electricity meter', {
            type: 'object',
            properties: {
                consumer_number: { type: 'string' },
                linked_units: { type: 'array', items: { type: 'string' } },
                initial_reading: { type: 'number' }
            },
            required: ['consumer_number']
        }, async (args) => {
            const meter = {
                id: `METER-${this.meters.length + 1}`,
                ...args,
                readings: args.initial_reading ? [{ date: new Date().toISOString(), value: args.initial_reading }] : []
            };
            this.meters.push(meter);
            return { status: "Meter Added", meter_id: meter.id };
        });

        // calculate_deposit
        this.registerTool('calculate_deposit', 'Calculate deposit based on rules', {
            type: 'object',
            properties: {
                monthly_rent: { type: 'number' },
                start_date: { type: 'string' } // YYYY-MM-DD
            },
            required: ['monthly_rent', 'start_date']
        }, async (args) => {
            const date = new Date(args.start_date);
            const day = date.getDate();
            let deposit = 2500; // Base Standard Deposit

            if (day >= 6 && day <= 10) {
                // Dynamic Calculation
                const dailyRent = args.monthly_rent / 30; // Approx
                let dynamicPart = dailyRent * 5;
                // Round to nearest 50
                dynamicPart = Math.round(dynamicPart / 50) * 50;
                deposit += dynamicPart;
            }

            return {
                base_deposit: 2500,
                total_deposit: deposit,
                rule_applied: (day >= 6 && day <= 10) ? "Standard + Dynamic (6th-10th)" : "Standard (1st-5th)"
            };
        });

        // get_public_rate_card
        this.registerTool('get_public_rate_card', 'Get the standard market rates', {
            type: 'object',
            properties: {}
        }, async () => {
            return {
                monthly_rent: 12000,
                base_security_deposit: 2500,
                payment_cycle_rules: "1st-5th: Standard; 6th-10th: Standard + 5 Days Rent",
                notice_period_days: 30,
                min_stay_months: 6,
                early_exit_rule: "DEPOSIT_FORFEIT"
            };
        });



        // update_meter_reading
        this.registerTool('update_meter_reading', 'Log a new meter reading', {
            type: 'object',
            properties: {
                meter_id: { type: 'string' },
                reading: { type: 'number' },
                date: { type: 'string' }
            },
            required: ['meter_id', 'reading']
        }, async (args) => {
            const meter = this.meters.find(m => m.id === args.meter_id);
            if (!meter) throw new Error("Meter ID not found");

            const entry = {
                date: args.date || new Date().toISOString(),
                value: args.reading
            };
            meter.readings.push(entry);

            // Logic: Calculate consumption from last reading could go here

            return { status: "Reading Updated", new_count: meter.readings.length };
        });

        // get_amenities
        this.registerTool('get_amenities', 'List available amenities', {
            type: 'object',
            properties: {}
        }, async () => {
            return {
                amenities: [
                    "WiFi", "Power Backup", "AC", "Geyser", "RO Water",
                    "Security", "CCTV", "Parking", "Lift", "Gym",
                    "Housekeeping", "Laundry"
                ]
            };
        });
    }
}

module.exports = PropertyAI;
