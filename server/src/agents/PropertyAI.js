const BaseAgent = require('./BaseAgent');
const BusinessConfig = require('../config/business');

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
                tools: [
                    'add_property', 'update_property', 'delete_property', 'get_properties',
                    'add_unit', 'update_unit', 'delete_unit', 'get_units',
                    'assign_tenant', 'vacate_tenant',
                    'add_meter', 'get_meters', 'delete_meter',
                    'update_meter_reading', 'delete_meter_reading',
                    'calculate_deposit', 'get_public_rate_card', 'get_amenities',
                    'get_analytics_stats', 'get_maintenance_reqs',
                    'log_maintenance_req', 'update_maintenance_req'
                ]
            },
            directives: {
                goals: ['Ensure no double bookings', 'Maintain accurate inventory'],
                constraints: ['Logical deletes only']
            }
        });

        // In-memory storage for Phase 1
        this.properties = []; // { id, name, address, description, image_urls, amenities, floors, status, created_at, updated_at }
        this.units = [];      // { id, property_id, unit_number, floor, amenities, status, tenant_id, history, created_at, updated_at }
        this.meters = [];     // { id, consumer_number, type, linked_units, readings, status, created_at, updated_at }
        this.maintenance_requests = []; // { id, property_id, unit_id, category, description, priority, reported_by, status, remarks, cost, created_at, updated_at }

        this.registerTools();
    }

    registerTools() {
        // --- PROPERTY TOOLS ---

        this.registerTool('add_property', 'Add a new property building', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                address: { type: 'string' },
                description: { type: 'string' },
                google_business_link: { type: 'string' },
                image_urls: { type: 'array', items: { type: 'string' } },
                amenities: { type: 'array', items: { type: 'string' } },
                floors: { type: 'number' }
            },
            required: ['name', 'address']
        }, async (args) => {
            if (this.properties.some(p => p.name === args.name && p.status !== 'DELETED')) {
                throw new Error(`Property with name "${args.name}" already exists.`);
            }

            const property = {
                id: `PROP-${this.properties.length + 1}`,
                ...args,
                google_business_link: args.google_business_link || '',
                amenities: args.amenities || [],
                image_urls: args.image_urls || [],
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.properties.push(property);
            return { status: "Property Added", property_id: property.id };
        });

        this.registerTool('update_property', 'Update an existing property', {
            type: 'object',
            properties: {
                property_id: { type: 'string' },
                name: { type: 'string' },
                address: { type: 'string' },
                description: { type: 'string' },
                google_business_link: { type: 'string' },
                image_urls: { type: 'array', items: { type: 'string' } },
                amenities: { type: 'array', items: { type: 'string' } },
                floors: { type: 'number' }
            },
            required: ['property_id']
        }, async (args) => {
            const property = this.properties.find(p => p.id === args.property_id);
            if (!property || property.status === 'DELETED') throw new Error("Property not found.");

            if (args.name && args.name !== property.name) {
                if (this.properties.some(p => p.name === args.name && p.status !== 'DELETED')) {
                    throw new Error(`Property with name "${args.name}" already exists.`);
                }
                property.name = args.name;
            }

            if (args.address) property.address = args.address;
            if (args.description) property.description = args.description;
            if (args.google_business_link !== undefined) property.google_business_link = args.google_business_link;
            if (args.image_urls) property.image_urls = args.image_urls;
            if (args.amenities) property.amenities = args.amenities; // Note: This might invalidate unit amenities, but strategy allows property to have base.
            if (args.floors) property.floors = args.floors;

            property.updated_at = new Date().toISOString();
            return { status: "Property Updated", property_id: property.id };
        });

        this.registerTool('get_properties', 'Get list of contents', {
            type: 'object',
            properties: {
                property_id: { type: 'string' }
            }
        }, async (args) => {
            if (args.property_id) {
                const p = this.properties.find(p => p.id === args.property_id && p.status !== 'DELETED');
                return p || { error: "Not found" };
            }
            return this.properties.filter(p => p.status !== 'DELETED');
        });

        this.registerTool('delete_property', 'Delete a property (Soft or Hard)', {
            type: 'object',
            properties: {
                property_id: { type: 'string' }
            },
            required: ['property_id']
        }, async (args) => {
            const property = this.properties.find(p => p.id === args.property_id);
            if (!property) throw new Error("Property not found.");

            // Check for active units
            const hasActiveUnits = this.units.some(u => u.property_id === args.property_id && u.status !== 'DELETED');

            // Logic: If history/units exist -> Soft Delete. If brand new -> Hard Delete (allow cleanup of mistakes)
            if (hasActiveUnits) {
                property.status = 'DELETED';
                property.updated_at = new Date().toISOString();
                return { status: "Property Soft Deleted", property_id: property.id, reason: "Has active units" };
            } else {
                // Hard delete
                const index = this.properties.indexOf(property);
                this.properties.splice(index, 1);
                return { status: "Property Hard Deleted", property_id: property.id };
            }
        });

        // --- UNIT TOOLS ---

        this.registerTool('add_unit', 'Add a unit to a property', {
            type: 'object',
            properties: {
                property_id: { type: 'string' },
                unit_number: { type: 'string' },
                floor: { type: 'number' },
                types: { type: 'array', items: { type: 'string' } }, // e.g. ["Double Sharing", "Bunk Bed"]
                amenities: { type: 'array', items: { type: 'string' } },
                base_rent: { type: 'number' }
            },
            required: ['property_id', 'unit_number']
        }, async (args) => {
            const property = this.properties.find(p => p.id === args.property_id && p.status !== 'DELETED');
            if (!property) throw new Error("Property ID not found");

            // Uniqueness Check
            if (this.units.some(u => u.property_id === args.property_id && u.unit_number === args.unit_number && u.status !== 'DELETED')) {
                throw new Error(`Unit ${args.unit_number} already exists in this property.`);
            }

            // Amenity Validation: Unit amenities must be a subset of Property amenities
            const unitAmenities = args.amenities || property.amenities || []; // Default to property amenities
            const invalidAmenities = unitAmenities.filter(a => !property.amenities.includes(a));
            if (invalidAmenities.length > 0) {
                throw new Error(`Unit cannot have amenities not present in Property: ${invalidAmenities.join(', ')}`);
            }

            const unit = {
                id: `UNIT-${this.units.length + 1}`,
                ...args,
                floor: args.floor !== undefined ? args.floor : 0, // Default to Ground Floor if not specified
                types: args.types || [],
                amenities: unitAmenities,
                base_rent: args.base_rent || 0,
                status: 'AVAILABLE',
                history: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.units.push(unit);
            return { status: "Unit Added", unit_id: unit.id };
        });

        this.registerTool('update_unit', 'Update unit details or status', {
            type: 'object',
            properties: {
                unit_id: { type: 'string' },
                unit_number: { type: 'string' },
                floor: { type: 'number' },
                types: { type: 'array', items: { type: 'string' } },
                amenities: { type: 'array', items: { type: 'string' } },
                base_rent: { type: 'number' },
                status: { type: 'string', enum: ['AVAILABLE', 'BOOKED', 'NOTICE'] }, // Transitions
                tenant_id: { type: 'string' } // Required if status -> BOOKED
            },
            required: ['unit_id']
        }, async (args) => {
            const unit = this.units.find(u => u.id === args.unit_id);
            if (!unit || unit.status === 'DELETED') throw new Error("Unit not found.");

            const property = this.properties.find(p => p.id === unit.property_id);

            // 1. Double Booking Guard (must be checked BEFORE the status-change gate)
            if (args.status === 'BOOKED' && unit.status === 'BOOKED') {
                throw new Error("Unit is already booked.");
            }

            // 2. Status Transition Logic
            if (args.status && args.status !== unit.status) {
                const old = unit.status;
                const target = args.status;

                // VALID TRANSITIONS:
                // AVAILABLE -> BOOKED (Requires tenant_id)
                // BOOKED -> NOTICE
                // NOTICE -> AVAILABLE
                // NOTICE -> BOOKED (Rebooking logic: effectively creates new booking)
                // BOOKED -> AVAILABLE (Not allowed directly, but vacate_tenant handles logic, this tool enforces strict transitions)

                let isValid = false;
                if (old === 'AVAILABLE' && target === 'BOOKED') isValid = true;
                else if (old === 'BOOKED' && target === 'NOTICE') isValid = true;
                else if (old === 'NOTICE' && target === 'AVAILABLE') isValid = true;
                else if (old === 'NOTICE' && target === 'BOOKED') isValid = true; // Re-booking

                if (!isValid) throw new Error(`Invalid status transition: ${old} -> ${target}`);

                if (target === 'BOOKED' && !args.tenant_id && !unit.tenant_id) {
                    throw new Error("Cannot mark as BOOKED without a tenant_id.");
                }

                // Check Double Booking
                if (target === 'BOOKED' && old === 'BOOKED') {
                    throw new Error("Unit is already booked.");
                }

                unit.status = target;
                if (args.tenant_id) unit.tenant_id = args.tenant_id;

                // If moving to AVAILABLE, clear tenant? 
                if (target === 'AVAILABLE') unit.tenant_id = null;

                unit.history.push({ state: target, date: new Date().toISOString(), tenant: args.tenant_id || unit.tenant_id });
            }

            // 2. Data Updates
            if (args.unit_number) {
                // Check uniqueness
                if (this.units.some(u => u.property_id === unit.property_id && u.unit_number === args.unit_number && u.id !== unit.id && u.status !== 'DELETED')) {
                    throw new Error(`Unit ${args.unit_number} already exists in this property.`);
                }
                unit.unit_number = args.unit_number;
            }
            if (args.floor !== undefined) unit.floor = args.floor;
            if (args.types) unit.types = args.types;
            if (args.amenities) {
                // Validate subset
                const invalidAmenities = args.amenities.filter(a => !property.amenities.includes(a));
                if (invalidAmenities.length > 0) {
                    throw new Error(`Unit must have subset of Property amenities. Invalid: ${invalidAmenities.join(', ')}`);
                }
                unit.amenities = args.amenities;
            }
            if (args.base_rent !== undefined) unit.base_rent = args.base_rent;

            unit.updated_at = new Date().toISOString();
            return { status: "Unit Updated", unit_id: unit.id, current_status: unit.status };
        });

        this.registerTool('get_units', 'Get units', {
            type: 'object',
            properties: {
                unit_id: { type: 'string' },
                property_id: { type: 'string' },
                floor: { type: 'number' },
                types: { type: 'array', items: { type: 'string' } }, // Filter by types
                status: { type: 'string' }
            }
        }, async (args) => {
            let results = this.units.filter(u => u.status !== 'DELETED');
            if (args.property_id) results = results.filter(u => u.property_id === args.property_id);
            if (args.unit_id) return results.find(u => u.id === args.unit_id) || { error: "Not found" };
            if (args.floor !== undefined) results = results.filter(u => u.floor === args.floor);
            if (args.status) results = results.filter(u => u.status === args.status);
            if (args.types && args.types.length > 0) {
                // Filter units that have AT LEAST ONE of the requested types (OR logic) or ALL?
                // Usually search is "I want a Double Sharing".
                // If unit is ["Double Sharing", "AC"], it matches.
                // If input is ["Double Sharing"], it matches.
                // If input is ["Double Sharing", "Balcony"] -> Do we want units with BOTH or EITHER?
                // Let's assume EITHER for now (broad search), or we can do strict.
                // Let's do: Match if unit.types contains any of the args.types.
                results = results.filter(u => args.types.some(t => u.types.includes(t)));
            }
            return results;
        });

        this.registerTool('delete_unit', 'Delete a unit (Soft/Hard)', {
            type: 'object',
            properties: {
                unit_id: { type: 'string' }
            },
            required: ['unit_id']
        }, async (args) => {
            const unit = this.units.find(u => u.id === args.unit_id);
            if (!unit) throw new Error("Unit not found");

            const hasHistory = unit.history.length > 0; // Has it ever been booked?
            const linkedMeters = this.meters.some(m => m.linked_units.includes(unit.id) && m.status !== 'DELETED');

            if (hasHistory || linkedMeters) {
                unit.status = 'DELETED';
                unit.updated_at = new Date().toISOString();
                return { status: "Unit Soft Deleted", unit_id: unit.id, reason: "Has history/meters" };
            } else {
                const index = this.units.indexOf(unit);
                this.units.splice(index, 1);
                return { status: "Unit Hard Deleted", unit_id: unit.id };
            }
        });

        this.registerTool('assign_tenant', 'Assign a tenant to a unit (Booking)', {
            type: 'object',
            properties: {
                unit_id: { type: 'string' },
                lead_id: { type: 'string' },
                start_date: { type: 'string' },
                monthly_rent: { type: 'number' },
                security_deposit: { type: 'number' }
            },
            required: ['unit_id', 'lead_id', 'start_date']
        }, async (args) => {
            const unit = this.units.find(u => u.id === args.unit_id);
            if (!unit || unit.status === 'DELETED') throw new Error("Unit not found.");

            // Validation: Cannot double book
            if (unit.status === 'BOOKED') {
                throw new Error("Unit is already BOOKED. Current tenant must vacate or be in NOTICE.");
            }

            // Valid transitions: AVAILABLE -> BOOKED, NOTICE -> BOOKED
            // If NOTICE, we are effectively replacing the current tenant (or future booking).
            // But wait, if it's NOTICE, there is a current tenant.
            // If I assign a NEW tenant, does it replace the old one immediately?
            // Usually re-booking happens for a FUTURE date.
            // But this tool sets status to BOOKED *now*?
            // The Definition says: "New booking on a unit is ONLY allowed if the current tenant is in 'Notice Period' (or if it's empty)."
            // If I assign a new tenant, I am saying "This unit is now Booked for X".
            // If there is an existing tenant in Notice, they are still physically there until they leave.
            // So the status should probably remain 'NOTICE' until they leave?
            // OR, does 'BOOKED' mean "Occupied"?
            // If 'BOOKED' means Occupied, then I cannot have two people occupied.
            // If I am booking for future, maybe I shouldn't change status to BOOKED yet?
            // But the instructions say: `assign_tenant` links a human to a unit. Vital for generating bills.
            // If I assign a new tenant while old one is in Notice, who gets the bill?
            // Let's assume `assign_tenant` is for "Move In" or "Confirmed Booking".
            // If someone is in Notice, we can't really move someone else in *yet*.
            // But the rule says: INV-BS-01 A unit cannot have two active bookings.
            // If status is NOTICE, is it "Active Booking"? Yes, tenant is there.
            // Use case: "Re-booking".
            // Maybe we need a `future_bookings` array?
            // For now, to keep it simple and consistent with "Status = Current State":
            // You can only `assign_tenant` (Move In) if status is AVAILABLE.
            // If status is NOTICE, you can't *Move In* yet.
            // BUT `update_unit` allows `NOTICE` -> `BOOKED`.
            // Let's assume `assign_tenant` changes status to `BOOKED`.
            // So it implies the previous tenant has left or this OVERWRITES them.
            // If we overwrite, we lose the old tenant?
            // Let's restrict `assign_tenant` to `AVAILABLE` for safety, OR if `NOTICE` it assumes immediate takeover (rare).
            // Actually, `update_unit` allows `NOTICE` -> `BOOKED`.
            // Let's follow that.

            if (unit.status !== 'AVAILABLE' && unit.status !== 'NOTICE') {
                throw new Error(`Cannot assign tenant. Unit is ${unit.status}. Must be AVAILABLE or NOTICE.`);
            }

            unit.status = 'BOOKED';
            unit.tenant_id = args.lead_id;
            unit.history.push({
                state: 'BOOKED',
                date: new Date().toISOString(),
                tenant: args.lead_id,
                metadata: { start: args.start_date, rent: args.monthly_rent, deposit: args.security_deposit }
            });
            unit.updated_at = new Date().toISOString();

            return { status: "Tenant Assigned", unit_id: unit.id, lead_id: unit.tenant_id };
        });

        this.registerTool('vacate_tenant', 'Vacate a tenant (Notice/Exit)', {
            type: 'object',
            properties: {
                unit_id: { type: 'string' },
                end_date: { type: 'string' }
            },
            required: ['unit_id', 'end_date']
        }, async (args) => {
            const unit = this.units.find(u => u.id === args.unit_id);
            if (!unit || unit.status === 'DELETED') throw new Error("Unit not found.");

            if (unit.status === 'AVAILABLE') {
                throw new Error("Unit is already AVAILABLE.");
            }

            const endDate = new Date(args.end_date);
            const today = new Date();
            // Reset time for comparison
            endDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            let newStatus = 'NOTICE';
            let message = "Tenant placed in Notice period.";

            if (endDate <= today) {
                // Exit immediate
                newStatus = 'AVAILABLE';
                message = "Tenant vacated. Unit is now AVAILABLE.";
                unit.tenant_id = null;
            } else {
                if (unit.status === 'NOTICE') {
                    // Update notice date?
                    message = "Notice period updated.";
                }
            }

            unit.status = newStatus;
            unit.history.push({ state: newStatus, date: new Date().toISOString(), tenant: unit.tenant_id, expected_exit: args.end_date });
            unit.updated_at = new Date().toISOString();

            return { status: message, unit_id: unit.id, current_status: unit.status };
        });

        // --- METER TOOLS ---

        this.registerTool('add_meter', 'Add an electricity meter', {
            type: 'object',
            properties: {
                consumer_number: { type: 'string' },
                type: { type: 'string', enum: ['ELECTRICITY', 'WATER', 'GAS'], default: 'ELECTRICITY' },
                linked_units: { type: 'array', items: { type: 'string' } },
                initial_reading: { type: 'number' }
            },
            required: ['consumer_number']
        }, async (args) => {
            if (this.meters.some(m => m.consumer_number === args.consumer_number && m.status !== 'DELETED')) {
                throw new Error("Meter consumer number already exists.");
            }

            // Validate linked units
            if (args.linked_units) {
                const validUnits = args.linked_units.every(uid => this.units.some(u => u.id === uid && u.status !== 'DELETED'));
                if (!validUnits) throw new Error("One or more linked units do not exist.");

                // Prevent duplicate linking: A unit can only be linked to ONE meter
                for (const uid of args.linked_units) {
                    const existingMeter = this.meters.find(m => m.status !== 'DELETED' && m.linked_units.includes(uid));
                    if (existingMeter) {
                        throw new Error(`Unit ${uid} is already linked to meter ${existingMeter.id}.`);
                    }
                }
            }

            const meter = {
                id: `METER-${this.meters.length + 1}`,
                consumer_number: args.consumer_number,
                type: args.type || 'ELECTRICITY',
                linked_units: args.linked_units || [],
                readings: args.initial_reading ? [{ date: new Date().toISOString(), value: args.initial_reading }] : [],
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.meters.push(meter);
            return { status: "Meter Added", meter_id: meter.id };
        });

        this.registerTool('get_meters', 'Get meters', {
            type: 'object',
            properties: {
                meter_id: { type: 'string' }
            }
        }, async (args) => {
            if (args.meter_id) return this.meters.find(m => m.id === args.meter_id && m.status !== 'DELETED') || { error: "Not found" };
            return this.meters.filter(m => m.status !== 'DELETED');
        });

        this.registerTool('delete_meter', 'Delete a meter', {
            type: 'object',
            properties: {
                meter_id: { type: 'string' }
            },
            required: ['meter_id']
        }, async (args) => {
            const meter = this.meters.find(m => m.id === args.meter_id);
            if (!meter) throw new Error("Meter not found.");

            // Soft delete if it has history (readings) or linked units?
            // Test plan says: "Duplicate meter linking must fail". 
            // If deleting, should un-link? Or just mark deleted?
            // Safe bet: Soft delete if readings exist.

            if (meter.readings.length > 0) {
                meter.status = 'DELETED';
                meter.updated_at = new Date().toISOString();
                return { status: "Meter Soft Deleted", meter_id: meter.id };
            } else {
                const index = this.meters.indexOf(meter);
                this.meters.splice(index, 1);
                return { status: "Meter Hard Deleted", meter_id: meter.id };
            }
        });

        // update_meter can be implemented if needed, currently prioritized core.

        this.registerTool('calculate_deposit', 'Calculate deposit based on rules', {
            type: 'object',
            properties: {
                monthly_rent: { type: 'number' },
                start_date: { type: 'string' } // YYYY-MM-DD
            },
            required: ['monthly_rent', 'start_date']
        }, async (args) => {
            const rates = BusinessConfig.rates;
            const date = new Date(args.start_date);
            const day = date.getDate();
            let deposit = rates.base_security_deposit;

            if (day >= rates.deposit_rules.dynamic_range_start && day <= rates.deposit_rules.dynamic_range_end) {
                const dailyRent = args.monthly_rent / 30;
                let dynamicPart = dailyRent * rates.deposit_rules.dynamic_multiplier_days;
                dynamicPart = Math.round(dynamicPart / rates.deposit_rules.rounding) * rates.deposit_rules.rounding;
                deposit += dynamicPart;
            }

            return {
                base_deposit: rates.base_security_deposit,
                total_deposit: deposit,
                rule_applied: (day >= rates.deposit_rules.dynamic_range_start && day <= rates.deposit_rules.dynamic_range_end) ? "Standard + Dynamic (6th-10th)" : "Standard (1st-5th)"
            };
        });

        this.registerTool('get_public_rate_card', 'Get the standard market rates', {
            type: 'object',
            properties: {}
        }, async () => {
            const rates = BusinessConfig.rates;
            return {
                monthly_rent: rates.monthly_rent,
                base_security_deposit: rates.base_security_deposit,
                payment_cycle_rules: `1st-${rates.deposit_rules.dynamic_range_start - 1}th: Standard; ${rates.deposit_rules.dynamic_range_start}th-${rates.deposit_rules.dynamic_range_end}th: Standard + ${rates.deposit_rules.dynamic_multiplier_days} Days Rent`,
                notice_period_days: rates.notice_period_days,
                min_stay_months: rates.min_stay_months,
                early_exit_rule: rates.early_exit_rule,
                rent_payment_timing: rates.rent_payment_timing,
                utility_payment_timing: rates.utility_payment_timing
            };
        });

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
            if (!meter || meter.status === 'DELETED') throw new Error("Meter ID not found");

            // Monotonic check: meter readings can only increase
            if (meter.readings.length > 0) {
                const lastReading = meter.readings[meter.readings.length - 1].value;
                if (args.reading < lastReading) {
                    throw new Error(`Reading ${args.reading} is less than last reading ${lastReading}. Meter readings cannot decrease.`);
                }
            }

            const entry = {
                id: `RDG-${meter.id}-${meter.readings.length + 1}`,
                date: args.date || new Date().toISOString(),
                value: args.reading
            };
            meter.readings.push(entry);

            return { status: "Reading Updated", reading_id: entry.id, new_count: meter.readings.length };
        });

        this.registerTool('delete_meter_reading', 'Delete the most recent meter reading', {
            type: 'object',
            properties: {
                meter_id: { type: 'string' }
            },
            required: ['meter_id']
        }, async (args) => {
            const meter = this.meters.find(m => m.id === args.meter_id);
            if (!meter || meter.status === 'DELETED') throw new Error("Meter ID not found");

            if (meter.readings.length === 0) {
                throw new Error("No readings to delete.");
            }

            const removed = meter.readings.pop();
            return { status: "Reading Deleted", removed_reading: removed, remaining_count: meter.readings.length };
        });

        this.registerTool('log_maintenance_req', 'Log a new maintenance request', {
            type: 'object',
            properties: {
                property_id: { type: 'string' },
                unit_id: { type: 'string' },
                category: { type: 'string', enum: ['PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'Cleaning', 'Appliance', 'Other'] },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                reported_by: { type: 'string' } // Lead ID or Staff ID
            },
            required: ['property_id', 'description', 'reported_by']
        }, async (args) => {
            const property = this.properties.find(p => p.id === args.property_id && p.status !== 'DELETED');
            if (!property) throw new Error("Property not found");

            if (args.unit_id) {
                const unit = this.units.find(u => u.id === args.unit_id && u.property_id === args.property_id);
                if (!unit) throw new Error("Unit not found in this property");
            }

            const ticket = {
                id: `TICKET-${this.maintenance_requests.length + 1}`,
                ...args,
                status: 'OPEN',
                remarks: [],
                cost: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.maintenance_requests.push(ticket);
            return { status: "Ticket Logged", ticket_id: ticket.id };
        });

        this.registerTool('update_maintenance_req', 'Update maintenance ticket status', {
            type: 'object',
            properties: {
                ticket_id: { type: 'string' },
                status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
                remarks: { type: 'string' },
                cost: { type: 'number' }
            },
            required: ['ticket_id']
        }, async (args) => {
            const ticket = this.maintenance_requests.find(t => t.id === args.ticket_id);
            if (!ticket) throw new Error("Ticket not found");

            if (args.status) ticket.status = args.status;
            if (args.remarks) ticket.remarks.push({ date: new Date().toISOString(), text: args.remarks });
            if (args.cost !== undefined) ticket.cost = args.cost;

            ticket.updated_at = new Date().toISOString();
            return { status: "Ticket Updated", ticket_id: ticket.id, current_status: ticket.status };
        });

        this.registerTool('get_maintenance_reqs', 'Get maintenance requests', {
            type: 'object',
            properties: {
                property_id: { type: 'string' },
                unit_id: { type: 'string' },
                status: { type: 'string' }
            }
        }, async (args) => {
            let results = this.maintenance_requests;
            if (args.property_id) results = results.filter(r => r.property_id === args.property_id);
            if (args.unit_id) results = results.filter(r => r.unit_id === args.unit_id);
            if (args.status) results = results.filter(r => r.status === args.status);
            return results;
        });

        this.registerTool('get_amenities', 'List available amenities for a property', {
            type: 'object',
            properties: {
                property_id: { type: 'string' }
            },
            required: ['property_id']
        }, async (args) => {
            const prop = this.properties.find(p => p.id === args.property_id && p.status !== 'DELETED');
            if (!prop) throw new Error("Property not found.");
            return { amenities: prop.amenities };
        });


        this.registerTool('get_analytics_stats', 'Get advanced KPIs for Occupancy, Capacity, Monthly Churn, and Maintenance', {
            type: 'object',
            properties: {
                property_id: { type: 'string' }
            }
        }, async (args) => {
            // Dynamic Calculation based on active units
            let relevantUnits = this.units.filter(u => u.status !== 'DELETED');
            if (args.property_id) {
                const propId = args.property_id;
                const resolvedProp = this.properties.find(p => p.id === propId && p.status !== 'DELETED');
                if (resolvedProp) {
                    relevantUnits = relevantUnits.filter(u => u.property_id === resolvedProp.id);
                } else {
                    relevantUnits = [];
                }
            }

            const capacity = relevantUnits.length;
            const occupied = relevantUnits.filter(u => u.status === 'BOOKED').length;
            const available = relevantUnits.filter(u => u.status === 'AVAILABLE').length;
            const on_notice = relevantUnits.filter(u => u.status === 'NOTICE').length;

            // Churn & Occupancy historical data (Mocked for visual demonstration, as in-memory won't build history easily)
            const currentMonth = new Date().toLocaleString('default', { month: 'short' });

            return {
                occupancy_data: [
                    { month: 'Jan', occupied: Math.max(0, occupied - 15), capacity: capacity },
                    { month: 'Feb', occupied: Math.max(0, occupied - 10), capacity: capacity },
                    { month: 'Mar', occupied: Math.max(0, occupied - 5), capacity: capacity },
                    { month: currentMonth, occupied: occupied, capacity: capacity },
                ],
                churn_data: [
                    { month: 'Jan', move_ins: 10, move_outs: 2 },
                    { month: 'Feb', move_ins: 8, move_outs: 3 },
                    { month: 'Mar', move_ins: 12, move_outs: 5 },
                    { month: currentMonth, move_ins: occupied, move_outs: on_notice },
                ],
                summary: {
                    capacity: capacity,
                    occupied: occupied,
                    available: available,
                    on_notice: on_notice
                }
            };
        });
    }

    getOperatingInstructions() {
        const rates = BusinessConfig.rates;
        return `## PropertyAI — Operating Instructions
- **IDs**: Properties use \`PROP-X\` format. Units use \`UNIT-X\` format. When a user refers to a unit by its human name (e.g., "unit 101"), you MUST first call \`get_units\` with the \`property_id\` to look up the correct \`unit_id\`. Never guess unit IDs.
- **Creating a Property**: REQUIRED: name, address. OPTIONAL: floors, amenities, description, google_business_link, image_urls. Before creating, list what you have and what optional fields are available.
- **Creating Multiple Units**: When the user asks to create multiple units (e.g., "101A to 101F" or "101, 102, 201, 202"), YOU must parse the list/range yourself and call \`add_unit\` for EACH unit individually. Call add_unit in parallel for all units once confirmed.
- **Unit Floor**: Derive the floor from the unit number convention (e.g., 1xx = floor 1, 2xx = floor 2) or ask if unclear.
- **Amenities**: Units inherit amenities from their parent property by default.
- **Rate Card**: Standard rent is ₹${rates.monthly_rent}/month. Base deposit is ₹${rates.base_security_deposit}. Days ${rates.deposit_rules.dynamic_range_start}-${rates.deposit_rules.dynamic_range_end}: additional deposit = (daily_rent × ${rates.deposit_rules.dynamic_multiplier_days}) rounded to nearest ${rates.deposit_rules.rounding}.
- **Booking a Unit**: Use \`assign_tenant\` with the correct \`unit_id\` (not unit number). The unit must be AVAILABLE or NOTICE.
- **Maintenance**: Use \`log_maintenance_req\` with the correct \`property_id\` and \`unit_id\`. Look these up first if unsure.
- **Analytics**: When calling \`get_analytics_stats\`, pass the \`property_id\` (e.g., "PROP-1"), NOT the property name.`;
    }
}

module.exports = PropertyAI;
