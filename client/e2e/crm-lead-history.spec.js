import { test, expect } from '@playwright/test';

test.describe('CRM Lead 360 GUI', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('master_ai_user', JSON.stringify({
                email: 'qa@test.local',
                name: 'QA User',
                type: 'Bypass'
            }));
            localStorage.setItem('pg_developer_mode', 'true');
        });

        await page.route('**/api/auth/context', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        email: 'qa@test.local',
                        profile_type: 'Staff',
                        permissions: {
                            admin_adapter: {
                                CRMAgent: [
                                    'get_dashboard_stats',
                                    'get_recent_leads',
                                    'search_leads',
                                    'get_lead',
                                    'get_lead_by_phone',
                                    'get_lead_by_email',
                                    'get_timeline',
                                    'get_leads_by_status',
                                    'get_lead_artifacts',
                                    'update_lead_snapshot',
                                    'add_secondary_phone',
                                    'add_manual_note',
                                    'change_status',
                                    'link_artifact'
                                ]
                            }
                        }
                    }
                }),
            });
        });

        const leadA = {
            lead_id: '+919800098000',
            name: 'Ankit Sharma',
            email: 'ankit@example.com',
            status: 'Visited',
            profile_type: 'Customer',
            unit_type_required: 'Double Sharing',
            source: { channel: 'WhatsApp', detail: 'Referral' },
            phones: { others: [{ number: '+919900011122', label: 'Friend' }] },
            created_at: '2026-03-04T09:00:00.000Z'
        };
        const leadB = {
            lead_id: '+919811112222',
            name: 'Priya Nair',
            email: 'priya@example.com',
            status: 'Enquiry',
            profile_type: 'Customer',
            unit_type_required: 'Single Room',
            source: { channel: 'Portal' },
            phones: { others: [] },
            created_at: '2026-03-03T09:00:00.000Z'
        };

        const timelineA = [
            {
                event_id: 'EVT-1',
                timestamp: '2026-03-04T10:42:00.000Z',
                type: 'SESSION',
                summary: 'Asked for double sharing options and requested a visit slot.'
            },
            {
                event_id: 'EVT-2',
                timestamp: '2026-03-04T10:30:00.000Z',
                type: 'STATUS_CHANGE',
                from: 'Enquiry',
                to: 'Visited',
                reason: 'Visit scheduled'
            },
            {
                event_id: 'EVT-3',
                timestamp: '2026-03-04T10:00:00.000Z',
                type: 'NOTE',
                author: 'staff',
                content: 'Budget sensitive; wants quick move-in.'
            }
        ];

        await page.route('**/api/master_ai/tools/execute', async (route) => {
            const req = route.request();
            const body = req.postDataJSON();
            const tool = body?.tool_name;
            const params = body?.parameters || {};

            let data;
            if (tool === 'get_dashboard_stats') {
                data = { total_leads: 2, enquiry: 1, visited: 1, onboarded: 0, left: 0 };
            } else if (tool === 'get_recent_leads') {
                data = { leads: [leadA, leadB] };
            } else if (tool === 'search_leads') {
                const q = String(params.query || '').toLowerCase();
                data = {
                    leads: [leadA, leadB].filter((lead) =>
                        lead.name.toLowerCase().includes(q) ||
                        lead.lead_id.includes(q) ||
                        String(lead.email || '').toLowerCase().includes(q)
                    )
                };
            } else if (tool === 'get_lead') {
                if (params.phone === leadA.lead_id) {
                    data = { status: 'Found', lead: leadA, timeline: timelineA };
                } else {
                    data = { status: 'Found', lead: leadB, timeline: [] };
                }
            } else if (tool === 'update_lead_snapshot') {
                if (params.lead_id === leadA.lead_id && typeof params.email === 'string') {
                    leadA.email = params.email;
                }
                data = { status: 'Snapshot Updated', lead_id: params.lead_id };
            } else if (tool === 'change_status') {
                if (params.lead_id === leadA.lead_id) {
                    const from = leadA.status;
                    leadA.status = params.to_status;
                    timelineA.push({
                        event_id: `EVT-status-${Date.now()}`,
                        timestamp: '2026-03-04T11:00:00.000Z',
                        type: 'STATUS_CHANGE',
                        from,
                        to: params.to_status,
                        reason: params.reason
                    });
                }
                data = { status: 'Status Updated', lead_id: params.lead_id };
            } else if (tool === 'add_manual_note') {
                if (params.lead_id === leadA.lead_id) {
                    timelineA.push({
                        event_id: `EVT-note-${Date.now()}`,
                        timestamp: '2026-03-04T11:05:00.000Z',
                        type: 'NOTE',
                        author: params.author || 'admin_gui',
                        content: params.content
                    });
                }
                data = { status: 'Note Added', lead_id: params.lead_id };
            } else if (tool === 'add_secondary_phone') {
                if (params.lead_id === leadA.lead_id) {
                    leadA.phones.others.push({
                        number: params.phone_number,
                        label: params.label || 'Secondary'
                    });
                }
                data = { status: 'Phone Added', lead_id: params.lead_id };
            } else {
                data = { status: 'Success' };
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data }),
            });
        });
    });

    test('loads lead 360, supports search, and filters timeline events', async ({ page }) => {
        await page.goto('/crm');

        await expect(page.getByRole('heading', { name: 'CRM Lead 360' })).toBeVisible();
        await expect(page.getByTestId('crm-kpi-total')).toContainText('2');
        await expect(page.getByTestId('crm-kpi-visited')).toContainText('1');

        await expect(page.getByTestId('crm-lead-name')).toContainText('Ankit Sharma');
        await expect(page.getByTestId('crm-timeline-event')).toHaveCount(3);

        await page.getByTestId('crm-filter-SESSION').click();
        await expect(page.getByTestId('crm-timeline-event')).toHaveCount(1);
        await expect(page.getByTestId('crm-timeline-list')).toContainText('Asked for double sharing');

        await page.getByTestId('crm-email-input').fill('ankit.updated@example.com');
        await page.getByTestId('crm-email-save').click();
        await expect(page.getByTestId('crm-lead-detail')).toContainText('ankit.updated@example.com');

        await expect(page.getByTestId('crm-merge-action')).toBeDisabled();
        await expect(page.getByTestId('crm-archive-action')).toBeDisabled();

        await page.getByTestId('crm-status-select').selectOption('Onboarded');
        await page.getByTestId('crm-status-save').click();
        await expect(page.getByTestId('crm-status-reason-error')).toContainText('Reason is required');
        await page.getByTestId('crm-status-reason').fill('Converted after site visit');
        await page.getByTestId('crm-status-save').click();
        await expect(page.getByTestId('crm-status-confirm-modal')).toBeVisible();
        await page.getByTestId('crm-status-confirm-cancel').click();
        await expect(page.getByTestId('crm-status-confirm-modal')).toHaveCount(0);

        await page.getByTestId('crm-status-save').click();
        await page.getByTestId('crm-status-confirm-yes').click();
        await expect(page.getByTestId('crm-lead-detail')).toContainText('Onboarded');

        await page.getByTestId('crm-note-input').fill('Customer confirmed move-in window.');
        await page.getByTestId('crm-note-save').click();
        await page.getByTestId('crm-filter-NOTE').click();
        await expect(page.getByTestId('crm-timeline-list')).toContainText('Customer confirmed move-in window.');

        await page.getByTestId('crm-filter-ALL').click();
        await page.getByTestId('crm-secondary-phone-input').fill('+919877665544');
        await page.getByTestId('crm-secondary-phone-save').click();
        await expect(page.getByTestId('crm-lead-detail')).toContainText('+919877665544');

        await page.getByTestId('crm-search-input').fill('priya');
        await page.getByTestId('crm-search-btn').click();
        await expect(page.getByTestId('crm-lead-+919811112222')).toBeVisible();

        await page.getByTestId('crm-lead-+919811112222').click();
        await expect(page.getByTestId('crm-lead-name')).toContainText('Priya Nair');
        await expect(page.getByTestId('crm-timeline-list')).toContainText('No timeline events.');
    });
});
