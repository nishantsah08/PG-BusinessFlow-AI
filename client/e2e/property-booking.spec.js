import { test, expect } from '@playwright/test';

const ISO_DATE = '2026-03-04T09:00:00.000Z';

function createMockState(mode = 'default') {
    if (mode === 'empty') {
        return {
            properties: [],
            unitsByProperty: {},
            meters: [],
            maintenanceTickets: [],
        };
    }

    return {
        properties: [
            {
                id: 'PROP-1',
                name: 'Sunrise Residency',
                address: '12 Lake View Road',
                description: 'Primary working property',
                google_business_link: '',
                floors: 3,
                pin_code: '411014',
                area: 'Indiranagar',
                city: 'Pune',
                state: 'Maharashtra',
                is_enabled: true,
                image_urls: ['data:image/gif;base64,R0lGODlhAQABAAAAACw='],
                amenities: ['WiFi', 'Power Backup'],
                can_delete: true,
                status: 'ACTIVE',
            },
            {
                id: 'PROP-2',
                name: 'Maple Heights',
                address: '88 Hill Street',
                description: 'Secondary property',
                google_business_link: '',
                floors: 2,
                pin_code: '411001',
                area: 'Koregaon Park',
                city: 'Pune',
                state: 'Maharashtra',
                is_enabled: true,
                image_urls: ['data:image/gif;base64,R0lGODlhAQABAAAAACw='],
                amenities: ['WiFi'],
                can_delete: true,
                status: 'ACTIVE',
            },
        ],
        unitsByProperty: {
            'PROP-1': [
                {
                    id: 'UNIT-101',
                    property_id: 'PROP-1',
                    unit_number: '101',
                    floor: 1,
                    status: 'AVAILABLE',
                    base_rent: 12000,
                    is_enabled: true,
                    can_delete: true,
                    types: ['Single Sharing'],
                    amenities: ['WiFi'],
                    rate_card: {
                        payment_cycle_rules: '1st-5th of every month: Standard Deposit; 6th-10th of every month: Additional Deposit'
                    }
                },
            ],
            'PROP-2': [],
        },
        meters: [
            {
                id: 'MTR-1',
                consumer_number: 'EL-1001',
                type: 'ELECTRICITY',
                linked_units: ['UNIT-101'],
                readings: [{ id: 'RD-1', value: 40.5, date: ISO_DATE }],
            },
        ],
        maintenanceTickets: [
            {
                id: 'REQ-1',
                property_id: 'PROP-1',
                unit_id: '101',
                category: 'PLUMBING',
                description: 'Leaking pipe in washroom',
                priority: 'HIGH',
                status: 'OPEN',
                reported_by: 'Staff',
            },
        ],
    };
}

function buildAnalyticsForProperty(units) {
    const occupied = units.filter((u) => u.status === 'BOOKED').length;
    const onNotice = units.filter((u) => u.status === 'NOTICE').length;
    const available = units.filter((u) => u.status === 'AVAILABLE').length;
    const capacity = units.length;

    return {
        occupancy_data: [
            { month: 'Jan', capacity, occupied },
            { month: 'Feb', capacity, occupied },
        ],
        churn_data: [
            { month: 'Jan', move_ins: 1, move_outs: 0 },
            { month: 'Feb', move_ins: 0, move_outs: 1 },
        ],
        summary: {
            capacity,
            occupied,
            on_notice: onNotice,
            available,
            open_tickets: 0,
            high_priority_tickets: 0,
            avg_resolution_hours: 12,
            resolved_this_month: 1,
        },
    };
}

function buildMaintenanceStats(tickets) {
    const openTickets = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
    const highPriority = tickets.filter((t) => t.priority === 'HIGH' || t.priority === 'CRITICAL').length;
    const resolvedThisMonth = tickets.filter((t) => t.status === 'RESOLVED').length;

    return {
        maintenance_data: [
            { name: 'Jan', created: tickets.length, resolved: resolvedThisMonth },
            { name: 'Feb', created: tickets.length, resolved: resolvedThisMonth },
        ],
        summary: {
            open_tickets: openTickets,
            high_priority_tickets: highPriority,
            avg_resolution_hours: 10,
            resolved_this_month: resolvedThisMonth,
        },
    };
}

async function installPropertyBookingMocks(page, mode = 'default', options = {}) {
    const state = createMockState(mode);
    const getPropertiesById = options.getPropertiesById;
    const mutateState = options.mutateState;
    if (typeof mutateState === 'function') {
        mutateState(state);
    }

    await page.route('**/api/upload/images', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { urls: ['/images/uploaded_mock.jpg'] } }),
        });
    });

    await page.route('**/api/property/tools/**', async (route) => {
        const url = route.request().url();
        return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: `Direct property tool path is disallowed in admin adapter mode: ${url}` }),
        });
    });

    await page.route('**/api/master_ai/tools/execute', async (route) => {
        const body = route.request().postDataJSON?.() || {};
        const { tool_name: tool, parameters = {} } = body;

        const ok = (data) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data }),
        });

        if (mode === 'failure' && (tool === 'get_properties' || tool === 'get_maintenance_reqs')) {
            return route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, error: `Forced failure for ${tool}` }),
            });
        }

        if (tool === 'get_properties') {
            if (parameters?.property_id) {
                const found = state.properties.find((p) => p.id === parameters.property_id) || null;
                if (getPropertiesById) {
                    return ok(getPropertiesById(parameters.property_id, found));
                }
                return ok(found || { error: `Property ${parameters.property_id} not found` });
            }
            return ok(state.properties);
        }

        if (tool === 'get_units') {
            return ok(state.unitsByProperty[parameters.property_id] || []);
        }

        if (tool === 'add_property') {
            const next = {
                id: `PROP-${state.properties.length + 1}`,
                status: 'ACTIVE',
                image_urls: [],
                is_enabled: true,
                amenities: [],
                ...parameters,
            };
            state.properties.push(next);
            state.unitsByProperty[next.id] = [];
            return ok({ property_id: next.id });
        }

        if (tool === 'update_property') {
            const prop = state.properties.find((p) => p.id === parameters.property_id);
            if (prop) Object.assign(prop, parameters);
            return ok({ property_id: parameters.property_id });
        }

        if (tool === 'delete_property') {
            const idx = state.properties.findIndex((p) => p.id === parameters.property_id);
            if (idx >= 0) {
                const [removed] = state.properties.splice(idx, 1);
                delete state.unitsByProperty[removed.id];
            }
            return ok({ deleted: true });
        }

        if (tool === 'add_unit') {
            const unit = {
                id: `UNIT-${Math.floor(Math.random() * 100000)}`,
                status: 'AVAILABLE',
                can_delete: true,
                ...parameters,
            };
            const list = state.unitsByProperty[parameters.property_id] || [];
            list.push(unit);
            state.unitsByProperty[parameters.property_id] = list;
            return ok({ unit_id: unit.id });
        }

        if (tool === 'update_unit') {
            const allUnits = Object.values(state.unitsByProperty).flat();
            const unit = allUnits.find((u) => u.id === parameters.unit_id);
            if (unit) Object.assign(unit, parameters);
            return ok({ unit_id: parameters.unit_id });
        }

        if (tool === 'disable_property') {
            const property = state.properties.find((p) => p.id === parameters.property_id);
            if (!property) {
                return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: `Property ${parameters.property_id} not found` }) });
            }
            property.is_enabled = false;
            return ok({ property_id: property.id, status: 'Property Disabled', disabled: true });
        }

        if (tool === 'enable_property') {
            const property = state.properties.find((p) => p.id === parameters.property_id);
            if (!property) {
                return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: `Property ${parameters.property_id} not found` }) });
            }
            property.is_enabled = true;
            return ok({ property_id: property.id, status: 'Property Enabled', disabled: false });
        }

        if (tool === 'disable_unit') {
            const allUnits = Object.values(state.unitsByProperty).flat();
            const unit = allUnits.find((u) => u.id === parameters.unit_id);
            if (!unit) {
                return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: `Unit ${parameters.unit_id} not found` }) });
            }
            unit.is_enabled = false;
            return ok({ unit_id: unit.id, status: 'Unit Disabled', disabled: true });
        }

        if (tool === 'enable_unit') {
            const allUnits = Object.values(state.unitsByProperty).flat();
            const unit = allUnits.find((u) => u.id === parameters.unit_id);
            if (!unit) {
                return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: `Unit ${parameters.unit_id} not found` }) });
            }
            unit.is_enabled = true;
            return ok({ unit_id: unit.id, status: 'Unit Enabled', disabled: false });
        }

        if (tool === 'delete_unit') {
            Object.keys(state.unitsByProperty).forEach((propertyId) => {
                state.unitsByProperty[propertyId] = state.unitsByProperty[propertyId].filter((u) => u.id !== parameters.unit_id);
            });
            return ok({ deleted: true });
        }

        if (tool === 'get_analytics_stats') {
            if (parameters.property_id) {
                const units = state.unitsByProperty[parameters.property_id] || [];
                return ok(buildAnalyticsForProperty(units));
            }
            return ok(buildMaintenanceStats(state.maintenanceTickets));
        }

        if (tool === 'get_meters') {
            return ok(state.meters);
        }

        if (tool === 'add_meter') {
            const nextMeter = {
                id: `MTR-${state.meters.length + 1}`,
                consumer_number: parameters.consumer_number,
                type: parameters.type || 'ELECTRICITY',
                linked_units: parameters.linked_units || [],
                readings: parameters.initial_reading !== undefined ? [{ id: 'RD-INIT', value: parameters.initial_reading, date: ISO_DATE }] : [],
            };
            state.meters.push(nextMeter);
            return ok({ meter_id: nextMeter.id });
        }

        if (tool === 'update_meter_reading') {
            const meter = state.meters.find((m) => m.id === parameters.meter_id);
            if (!meter) {
                return route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: false, error: 'Meter not found' }),
                });
            }
            meter.readings.push({
                id: `RD-${meter.readings.length + 1}`,
                value: parameters.reading,
                date: parameters.date || ISO_DATE,
            });
            return ok({ updated: true });
        }

        if (tool === 'delete_meter') {
            const index = state.meters.findIndex((m) => m.id === parameters.meter_id);
            if (index >= 0) state.meters.splice(index, 1);
            return ok({ deleted: true });
        }

        if (tool === 'get_maintenance_reqs') {
            return ok(state.maintenanceTickets);
        }

        if (tool === 'log_maintenance_req') {
            const next = {
                id: `REQ-${state.maintenanceTickets.length + 1}`,
                status: 'OPEN',
                ...parameters,
            };
            state.maintenanceTickets.unshift(next);
            return ok({ ticket_id: next.id });
        }

        if (tool === 'update_maintenance_req') {
            const ticketId = parameters.req_id || parameters.ticket_id;
            const ticket = state.maintenanceTickets.find((t) => t.id === ticketId);
            if (ticket) ticket.status = parameters.status;
            return ok({ updated: true });
        }

        return route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: `Unmocked tool ${tool}` }),
        });
    });
}

test.describe('Property & Booking GUI', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('master_ai_user', JSON.stringify({
                email: 'qa@property.local',
                name: 'Property QA',
                type: 'Bypass',
            }));
            localStorage.setItem('pg_developer_mode', 'true');
        });
    });

    test('renders all four sections and allows section switching', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        await expect(page.getByRole('heading', { name: 'Property & Booking' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Property Management' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Booking Overview' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Electric Meters' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Maintenance' })).toBeVisible();

        await expect(page.getByText('Properties (2)')).toBeVisible();

        await page.getByRole('button', { name: 'Booking Overview' }).click();
        await expect(page.getByText('Dashboard Metrics')).toBeVisible();

        await page.getByRole('button', { name: 'Electric Meters' }).click();
        await expect(page.getByText('Utility Meters')).toBeVisible();

        await page.getByRole('button', { name: 'Maintenance' }).click();
        await expect(page.getByText('Active Tickets')).toBeVisible();
    });

    test('Property Management supports unit creation on selected property', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        await expect(page.getByRole('heading', { name: 'Sunrise Residency' }).first()).toBeVisible();
        await page.getByRole('button', { name: 'Add Unit' }).click();

        await page.getByLabel(/Unit Number/i).fill('102');
        await page.getByLabel(/^Floor/i).fill('1');
        await page.getByRole('button', { name: '+ Single Sharing' }).click();
        const paymentCycleRulesField = page.getByLabel('Monthly Payment Cycle');
        await expect(paymentCycleRulesField).toHaveValue('1st-5th of every month: Standard Deposit; 6th-10th of every month: Additional Deposit');
        await expect(paymentCycleRulesField).toContainText('Standard monthly 2-cycle rule');
        await expect(page.getByText('1st-5th of every month: Standard Deposit')).toBeVisible();
        await expect(page.getByText('6th-10th of every month: Additional Deposit')).toBeVisible();
        await paymentCycleRulesField.selectOption({ label: 'Standard monthly 2-cycle rule' });
        await page.getByRole('button', { name: 'Add Unit' }).nth(1).click();

        await expect(page.getByText('Unit 102')).toBeVisible();
    });

    test('Property disable state gates unit operations and can be re-enabled', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        const addUnitButton = page.getByRole('button', { name: 'Add Unit' }).first();
        await expect(addUnitButton).toBeEnabled();
        await page.getByRole('button', { name: 'Open property actions' }).click();
        await expect(page.getByRole('button', { name: 'Disable Property' })).toBeVisible();

        await page.getByRole('button', { name: 'Disable Property' }).click();

        await expect(addUnitButton).toBeDisabled();
        await page.getByRole('button', { name: 'Open property actions' }).click();
        await expect(page.getByRole('button', { name: 'Enable Property' })).toBeVisible();

        await expect(page.getByText('Disabled').first()).toBeVisible();

        await page.getByRole('button', { name: 'Enable Property' }).click();

        await page.getByRole('button', { name: 'Open property actions' }).click();
        await expect(page.getByRole('button', { name: 'Disable Property' })).toBeVisible();
        await expect(addUnitButton).toBeEnabled();
        await expect(page.getByText('ACTIVE')).toHaveCount(0);
    });

    test('Unit disable state blocks editing and shows disabled indicator', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        const unitRow = page
            .getByText('Unit 101')
            .first()
            .locator('xpath=ancestor::div[contains(@class, "flex justify-between")][1]');

        await unitRow.getByRole('button', { name: 'Open actions for Unit 101' }).click();
        const disableUnitButton = unitRow.getByRole('checkbox', { name: 'Disable Unit 101' });
        const editUnitButton = unitRow.getByRole('button', { name: 'Edit Unit 101' });

        await disableUnitButton.click({ force: true });

        await expect(unitRow.getByText('Disabled')).toBeVisible();

        await unitRow.getByRole('button', { name: 'Open actions for Unit 101' }).click();
        await expect(editUnitButton).toBeDisabled();
        await editUnitButton.click({ force: true });
        await expect(page.getByRole('heading', { name: 'Edit Unit' })).toHaveCount(0);
    });

    test('Property Management edit form pre-fills and enables Save when image exists', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        await expect(page.getByRole('heading', { name: 'Sunrise Residency' }).first()).toBeVisible();
        await expect(page.getByText('"Primary working property"')).toBeVisible();
        await page.getByRole('button', { name: 'Open property actions' }).click();
        await page.getByRole('button', { name: 'Edit Details' }).click();

        await expect(page.getByRole('heading', { name: 'Edit Property' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save Property' })).toBeEnabled();
        await expect(page.getByPlaceholder('e.g. Emerald Heights')).toHaveValue('Sunrise Residency');
        await expect(page.getByPlaceholder('e.g. 411014')).toHaveValue('411014');

        await expect(page.getByRole('img', { name: 'Property' }).first()).toBeVisible();
    });

    test('Property edit prefill keeps required images even when refresh payload drops image fields', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default', {
            getPropertiesById: (_propertyId, property) => {
                if (!property) return { error: 'Property not found' };
                return {
                    id: property.id,
                    name: property.name,
                    address: property.address,
                    description: property.description,
                    google_business_link: property.google_business_link,
                    floors: property.floors,
                    pin_code: property.pin_code,
                    status: property.status,
                    area: property.area,
                    city: property.city,
                    state: property.state,
                    amenities: property.amenities,
                    // Intentionally omit image_urls and thumbnail_url to mimic older/partial backend payload.
                };
            },
        });

        await page.goto('/property');

        await expect(page.getByRole('heading', { name: 'Sunrise Residency' }).first()).toBeVisible();
        await page.getByRole('button', { name: 'Open property actions' }).click();
        await page.getByRole('button', { name: 'Edit Details' }).click();

        await expect(page.getByRole('heading', { name: 'Edit Property' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Save Property/i })).toBeEnabled();
        await expect(page.locator('input[placeholder=\"e.g. Emerald Heights\"]').first()).toHaveValue('Sunrise Residency');
        await expect(page.getByRole('img', { name: 'Property' }).first()).toBeVisible();
    });

    test('overflow menus hide delete when property or unit has prior activity', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default', {
            mutateState: (state) => {
                state.properties[0].can_delete = false;
                state.unitsByProperty['PROP-1'][0].can_delete = false;
            }
        });
        await page.goto('/property');

        await page.getByRole('button', { name: 'Open property actions' }).click();
        await expect(page.getByText('Delete unavailable for active units/transactions.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete Property' })).toHaveCount(0);

        const unitRow = page
            .getByText('Unit 101')
            .first()
            .locator('xpath=ancestor::div[contains(@class, "flex justify-between")][1]');
        await unitRow.getByRole('button', { name: 'Open actions for Unit 101' }).click();
        await expect(unitRow.getByText('Delete unavailable due to prior activity.')).toBeVisible();
        await expect(unitRow.getByRole('button', { name: 'Delete Unit 101' })).toHaveCount(0);
    });

    test('Booking Overview shows zero-unit edge message for property without units', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        await page.getByRole('button', { name: 'Booking Overview' }).click();
        await page.getByRole('combobox').selectOption('PROP-2');

        await expect(page.getByText('No Physical Layout Created')).toBeVisible();
    });

    test('Electric Meters supports add meter and add reading', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        await page.getByRole('button', { name: 'Electric Meters' }).click();
        await page.getByRole('button', { name: 'Add' }).click();

        await page.getByLabel(/Consumer \/ Meter Number/i).fill('EL-2026');
        await page.getByLabel(/Initial Reading/i).fill('10');
        await page.getByRole('button', { name: 'Save Meter' }).click();

        await expect(page.getByText('EL-2026')).toBeVisible();
        await page.getByText('EL-2026').click();

        await page.getByPlaceholder('0.00').fill('17.2');
        await page.getByRole('button', { name: 'Add' }).nth(1).click();
        await expect(page.getByText('17.2', { exact: true }).first()).toBeVisible();
    });

    test('Maintenance supports log ticket and status progression', async ({ page }) => {
        await installPropertyBookingMocks(page, 'default');
        await page.goto('/property');

        await page.getByRole('button', { name: 'Maintenance' }).click();
        await page.getByRole('button', { name: 'Log Issue' }).click();

        await page.getByPlaceholder('Unit/Location (e.g. 101)').fill('Lobby');
        await page.getByPlaceholder('Describe issue (e.g. Leaking pipe)').fill('Lift panel sparking');
        await page.getByRole('button', { name: 'Submit Ticket' }).click();

        await expect(page.getByText('Lift panel sparking')).toBeVisible();
        await page.getByRole('button', { name: 'Expand' }).first().click();
        await page.getByPlaceholder('Required remark for status change').fill('Assigned electrician for immediate check.');
        await page.getByRole('button', { name: 'Mark IN PROGRESS' }).first().click();
        await expect(page.locator('span').filter({ hasText: /^In Progress$/ }).first()).toBeVisible();
    });

    test('handles empty dataset across sections without crash', async ({ page }) => {
        await installPropertyBookingMocks(page, 'empty');
        await page.goto('/property');

        await expect(page.getByText('No properties found.')).toBeVisible();

        await page.getByRole('button', { name: 'Booking Overview' }).click();
        await expect(page.getByText('Dashboard Metrics')).toBeVisible();

        await page.getByRole('button', { name: 'Electric Meters' }).click();
        await expect(page.getByText("No meters associated with this property's units.")).toBeVisible();

        await page.getByRole('button', { name: 'Maintenance' }).click();
        await expect(page.getByText('No active maintenance tickets found.')).toBeVisible();
    });

    test('survives backend failures for master tool endpoints', async ({ page }) => {
        await installPropertyBookingMocks(page, 'failure');
        await page.goto('/property');

        await expect(page.getByRole('heading', { name: 'Property & Booking' })).toBeVisible();
        await page.getByRole('button', { name: 'Maintenance' }).click();
        await expect(page.getByText('Active Tickets')).toBeVisible();
    });
});
