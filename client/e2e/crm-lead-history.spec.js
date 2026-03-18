import { test, expect } from '@playwright/test';

const leadA = {
    lead_id: '+919800098000',
    name: 'Asha Menon',
    email: 'asha@example.com',
    status: 'Visited',
    profile_type: 'Customer',
    unit_type_required: 'Double Sharing',
    source: { channel: 'WhatsApp', detail: 'Referral' },
    demographics: { budget: '₹14,000', move_in: 'Within 7 days' },
    preferences: ['Quiet room', 'Strong Wi-Fi'],
    phones: {
        primary: { number: '+919800098000', whatsapp: true },
        others: [{ number: '+919900011122', label: 'Friend', whatsapp: false }],
    },
    ai_notes: { urgency: 'High', negotiation_style: 'Practical' },
    created_at: '2026-03-04T09:00:00.000Z'
};

const leadB = {
    lead_id: '+919811112222',
    name: 'Asha M.',
    email: 'asha@example.com',
    status: 'Enquiry',
    profile_type: 'Customer',
    unit_type_required: 'Double Sharing',
    source: { channel: 'WhatsApp', detail: 'Referral' },
    demographics: { budget: '₹14,000', move_in: 'Within 10 days' },
    preferences: ['Budget sensitive'],
    phones: {
        primary: { number: '+919811112222', whatsapp: true },
        others: [],
    },
    ai_notes: { urgency: 'Medium' },
    created_at: '2026-03-05T10:00:00.000Z'
};

const makeTimeline = () => ([
    {
        event_id: 'EVT-1',
        timestamp: '2026-03-04T10:42:00.000Z',
        type: 'SESSION',
        summary: 'Asked for double sharing options and requested a visit slot.',
        sentiment: 'Positive',
        tone: 'Practical',
        financial_impact: 'Medium',
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
]);

const buildPermissions = (canMerge) => ([
    'get_dashboard_stats',
    'get_merge_candidates',
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
    'change_status',
    ...(canMerge ? ['merge_leads'] : []),
]);

async function setupRoutes(page, canMerge = false) {
    const leads = [structuredClone(leadA), structuredClone(leadB)];
    const timelines = {
        [leadA.lead_id]: makeTimeline(),
        [leadB.lead_id]: [],
    };
    const artifacts = {
        [leadA.lead_id]: [
            { url: '/images/aadhaar.pdf', description: 'Aadhaar.pdf', type: 'KYC', date: '2026-03-04T11:00:00.000Z' },
            { url: '/images/pan.pdf', description: 'PAN.pdf', type: 'KYC', date: '2026-03-04T11:05:00.000Z' },
        ],
        [leadB.lead_id]: [],
    };

    const findLead = (leadId) => leads.find((lead) => lead.lead_id === leadId);
    const getMergeCandidates = () => {
        if (!findLead(leadA.lead_id) || !findLead(leadB.lead_id)) return [];
        return [{
            candidate_id: `${leadB.lead_id}__${leadA.lead_id}`,
            confidence: 92,
            relationship: 'Duplicate',
            reasons: ['Same email', 'Same last name', 'Same source channel'],
            source: findLead(leadB.lead_id),
            target: findLead(leadA.lead_id),
        }];
    };

    await page.route('**/api/auth/context', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    email: canMerge ? 'ceo@test.local' : 'staff@test.local',
                    profile_type: canMerge ? 'CEO' : 'Staff',
                    permissions: {
                        admin_adapter: {
                            CRMAgent: buildPermissions(canMerge),
                        }
                    }
                }
            }),
        });
    });

    await page.route('**/api/master_ai/tools/execute', async (route) => {
        const req = route.request();
        const body = req.postDataJSON();
        const tool = body?.tool_name;
        const params = body?.parameters || {};

        let data = {};
        if (tool === 'get_dashboard_stats') {
            data = {
                total_leads: leads.length,
                enquiry: leads.filter((lead) => lead.status === 'Enquiry').length,
                visited: leads.filter((lead) => lead.status === 'Visited').length,
                onboarded: leads.filter((lead) => lead.status === 'Onboarded').length,
                left: leads.filter((lead) => lead.status === 'Left').length,
                pending_follow_up: leads.filter((lead) => lead.status === 'Enquiry' || lead.status === 'Visited').length,
            };
        } else if (tool === 'get_merge_candidates') {
            data = { candidates: getMergeCandidates() };
        } else if (tool === 'get_recent_leads') {
            data = { leads };
        } else if (tool === 'search_leads') {
            const q = String(params.query || '').toLowerCase();
            data = {
                leads: leads.filter((lead) =>
                    lead.name.toLowerCase().includes(q) ||
                    lead.lead_id.includes(q) ||
                    String(lead.email || '').toLowerCase().includes(q)
                )
            };
        } else if (tool === 'get_lead') {
            const lead = findLead(params.phone);
            data = { status: 'Found', lead, timeline: timelines[params.phone] || [] };
        } else if (tool === 'get_lead_artifacts') {
            data = { artifacts: artifacts[params.lead_id] || [] };
        } else if (tool === 'update_lead_snapshot') {
            const lead = findLead(params.lead_id);
            if (lead) {
                if (typeof params.email === 'string') lead.email = params.email;
                if (typeof params.profile_type === 'string') lead.profile_type = params.profile_type;
                if (params.source) lead.source = params.source;
                if (params.demographics) {
                    lead.demographics = { ...(lead.demographics || {}), ...params.demographics };
                    if (params.demographics.unit_type_required) {
                        lead.unit_type_required = params.demographics.unit_type_required;
                    }
                }
                if (Array.isArray(params.preferences)) lead.preferences = params.preferences;
            }
            data = { status: 'Snapshot Updated', lead_id: params.lead_id };
        } else if (tool === 'add_secondary_phone') {
            const lead = findLead(params.lead_id);
            if (lead) {
                lead.phones.others.push({ number: params.phone_number, label: params.label || 'Secondary', whatsapp: false });
            }
            data = { status: 'Phone Added', lead_id: params.lead_id };
        } else if (tool === 'change_status') {
            const lead = findLead(params.lead_id);
            if (lead) {
                const from = lead.status;
                lead.status = params.to_status;
                timelines[params.lead_id].unshift({
                    event_id: `EVT-status-${Date.now()}`,
                    timestamp: '2026-03-04T11:00:00.000Z',
                    type: 'STATUS_CHANGE',
                    from,
                    to: params.to_status,
                    reason: params.reason,
                });
            }
            data = { status: 'Status Updated', lead_id: params.lead_id };
        } else if (tool === 'merge_leads') {
            const sourceIndex = leads.findIndex((lead) => lead.lead_id === params.source_lead_id);
            const target = findLead(params.target_lead_id);
            if (sourceIndex >= 0 && target) {
                const [source] = leads.splice(sourceIndex, 1);
                target.phones.others.push({ number: source.lead_id, label: 'Merged', whatsapp: true });
                timelines[target.lead_id].unshift({
                    event_id: `EVT-merge-${Date.now()}`,
                    timestamp: '2026-03-05T12:00:00.000Z',
                    type: 'MERGE',
                    absorbed_lead_id: source.lead_id,
                    relationship: params.relationship,
                });
                delete timelines[source.lead_id];
                delete artifacts[source.lead_id];
            }
            data = { status: 'Merge Complete', surviving_lead_id: params.target_lead_id };
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data }),
        });
    });
}

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
        localStorage.setItem('master_ai_user', JSON.stringify({
            email: 'qa@test.local',
            name: 'QA User',
            type: 'Bypass'
        }));
        localStorage.setItem('pg_developer_mode', 'true');
    });
});

test('staff sees overview and uses drawer safe edits without merge approval', async ({ page }) => {
    await setupRoutes(page, false);
    await page.goto('/crm');

    await expect(page.getByTestId('crm-console')).toBeVisible();
    await page.getByTestId('crm-tab-overview').click();
    await expect(page.getByTestId('crm-kpi-total')).toContainText('2');
    await expect(page.getByTestId('crm-kpi-pending-follow-up')).toContainText('2');

    await page.getByTestId('crm-merge-open-+919811112222__+919800098000').click();
    await expect(page.getByTestId('crm-merge-approve-+919811112222__+919800098000')).toBeDisabled();

    await page.getByTestId('crm-tab-leads').click();
    await page.getByTestId('crm-lead-+919800098000').click();
    await expect(page.getByTestId('crm-lead-detail')).toBeVisible();
    await expect(page.getByTestId('crm-lead-name')).toContainText('Asha Menon');
    await expect(page.getByTestId('crm-lead-detail')).toContainText('Aadhaar.pdf');

    await page.getByTestId('crm-email-toggle').click();
    await page.getByTestId('crm-email-input').fill('asha.updated@example.com');
    await page.getByTestId('crm-email-save').click();
    await expect(page.getByTestId('crm-lead-detail')).toContainText('asha.updated@example.com');

    await page.getByTestId('crm-status-trigger').click();
    await page.getByTestId('crm-status-save').click();
    await expect(page.getByTestId('crm-status-reason-error')).toContainText('Reason is required');
    await page.getByTestId('crm-status-reason').fill('Converted after visit');
    await page.getByTestId('crm-status-select').selectOption('Onboarded');
    await page.getByTestId('crm-status-save').click();
    await expect(page.getByTestId('crm-status-confirm-modal')).toBeVisible();
    await page.getByTestId('crm-status-confirm-cancel').click();
    await expect(page.getByTestId('crm-status-confirm-modal')).toHaveCount(0);

    await page.getByTestId('crm-status-save').click();
    await page.getByTestId('crm-status-confirm-yes').click();
    await expect(page.getByTestId('crm-status-trigger')).toContainText('Onboarded');

    await page.getByTestId('crm-secondary-phone-toggle').click();
    await page.getByTestId('crm-secondary-phone-input').fill('+919877665544');
    await page.getByTestId('crm-secondary-phone-save').click();
    await expect(page.getByTestId('crm-lead-detail')).toContainText('+919877665544');

    await page.getByTestId('crm-filter-SESSION').click();
    await expect(page.getByTestId('crm-timeline-event')).toHaveCount(1);
    await expect(page.getByTestId('crm-timeline-list')).toContainText('Asked for double sharing options');
});

test('ceo can approve a merge candidate from the overview queue', async ({ page }) => {
    await setupRoutes(page, true);
    await page.goto('/crm');

    await expect(page.getByTestId('crm-console')).toBeVisible();
    await page.getByTestId('crm-tab-overview').click();
    await page.getByTestId('crm-merge-open-+919811112222__+919800098000').click();
    await page.getByTestId('crm-merge-approve-+919811112222__+919800098000').click();

    await expect(page.getByTestId('crm-merge-queue')).toContainText('No system-flagged merge candidates right now.');
    await page.getByTestId('crm-tab-leads').click();
    await expect(page.getByTestId('crm-lead-+919811112222')).toHaveCount(0);
    await expect(page.getByTestId('crm-lead-+919800098000')).toBeVisible();
});
