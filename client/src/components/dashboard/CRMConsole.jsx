import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Phone, Mail, Clock3, Filter, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const TIMELINE_FILTERS = ['ALL', 'SESSION', 'STATUS_CHANGE', 'NOTE', 'MERGE', 'ARTIFACT_LINKED'];
const STATUS_OPTIONS = ['Enquiry', 'Visited', 'Onboarded', 'Left'];
const LEAD_STATUS_FILTER_OPTIONS = ['ALL', ...STATUS_OPTIONS];
const PROFILE_FILTER_OPTIONS = ['ALL', 'Customer', 'Staff', 'CEO'];
const TAB_OPTIONS = ['overview', 'leads'];

const emptyStats = {
    total_leads: 0,
    enquiry: 0,
    visited: 0,
    onboarded: 0,
    left: 0,
    pending_follow_up: 0,
};

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const statusToneMap = {
    Enquiry: 'bg-sky-100 text-sky-800 border-sky-200',
    Visited: 'bg-amber-100 text-amber-800 border-amber-200',
    Onboarded: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Left: 'bg-rose-100 text-rose-800 border-rose-200',
};

const toneClassForStatus = (status) => statusToneMap[status] || 'bg-slate-100 text-slate-700 border-slate-200';

const formatSource = (source) => {
    if (!source) return 'Not specified';
    const parts = [source.channel, source.detail].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Not specified';
};

const formatTimestamp = (value) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const buildMovementSeries = (leads) => {
    const grouped = new Map();
    leads.forEach((lead) => {
        const rawDate = String(lead.created_at || '').slice(0, 10);
        if (!rawDate) return;
        if (!grouped.has(rawDate)) {
            grouped.set(rawDate, { date: rawDate, total: 0, enquiry: 0, visited: 0, onboarded: 0 });
        }
        const bucket = grouped.get(rawDate);
        bucket.total += 1;
        if (lead.status === 'Enquiry') bucket.enquiry += 1;
        if (lead.status === 'Visited') bucket.visited += 1;
        if (lead.status === 'Onboarded') bucket.onboarded += 1;
    });

    return Array.from(grouped.values())
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(-6)
        .map((entry) => ({
            ...entry,
            label: new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        }));
};

const buildFunnelRows = (stats) => {
    const total = Math.max(1, toNumber(stats.total_leads));
    return [
        { key: 'enquiry', label: 'Enquiry', count: toNumber(stats.enquiry), color: 'bg-sky-500' },
        { key: 'visited', label: 'Visited', count: toNumber(stats.visited), color: 'bg-amber-500' },
        { key: 'onboarded', label: 'Onboarded', count: toNumber(stats.onboarded), color: 'bg-emerald-500' },
        { key: 'left', label: 'Left', count: toNumber(stats.left), color: 'bg-rose-500' },
    ].map((row) => ({
        ...row,
        width: Math.max(8, Math.round((row.count / total) * 100)),
    }));
};

const extractRequirement = (lead) => ({
    unitType: lead?.unit_type_required || lead?.demographics?.unit_type_required || 'Not specified',
    budget: lead?.demographics?.budget || lead?.ai_notes?.budget || 'Not specified',
    moveIn: lead?.demographics?.move_in || lead?.ai_notes?.move_in || 'Not specified',
    preferences: Array.isArray(lead?.preferences) && lead.preferences.length > 0
        ? lead.preferences.join(', ')
        : (lead?.demographics?.preferences || 'Not specified')
});

const isKycArtifact = (artifact) => {
    const haystack = `${artifact?.description || ''} ${artifact?.type || ''} ${artifact?.url || ''}`.toLowerCase();
    return haystack.includes('aadhaar') || haystack.includes('pan') || haystack.includes('kyc') || haystack.includes('police');
};

const renderEventMeta = (event) => {
    if (event.type === 'STATUS_CHANGE') {
        return `${event.from || 'Unknown'} -> ${event.to || 'Unknown'}${event.reason ? ` (${event.reason})` : ''}`;
    }
    if (event.type === 'SESSION') {
        return event.summary || 'Session event';
    }
    if (event.type === 'NOTE') {
        return `${event.author || 'system'}: ${event.content || ''}`;
    }
    if (event.type === 'MERGE') {
        return `Absorbed ${event.absorbed_lead_id || 'unknown lead'}${event.relationship ? ` (${event.relationship})` : ''}`;
    }
    if (event.type === 'ARTIFACT_LINKED') {
        return `${event.file_type || 'Generic'}: ${event.description || event.url || 'Artifact linked'}`;
    }
    return JSON.stringify(event);
};

const InlineTriangleButton = ({ onClick, active, testId }) => (
    <button
        type="button"
        onClick={onClick}
        className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${active ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
        data-testid={testId}
    >
        &#9662;
    </button>
);

const CRMConsole = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState(emptyStats);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [profileFilter, setProfileFilter] = useState('ALL');
    const [leads, setLeads] = useState([]);
    const [mergeCandidates, setMergeCandidates] = useState([]);
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [selectedLead, setSelectedLead] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [timelineFilter, setTimelineFilter] = useState('ALL');
    const [activeTab, setActiveTab] = useState('overview');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeEditor, setActiveEditor] = useState('');
    const [emailDraft, setEmailDraft] = useState('');
    const [profileTypeDraft, setProfileTypeDraft] = useState('Customer');
    const [sourceChannelDraft, setSourceChannelDraft] = useState('');
    const [sourceDetailDraft, setSourceDetailDraft] = useState('');
    const [secondaryPhoneDraft, setSecondaryPhoneDraft] = useState('');
    const [unitTypeDraft, setUnitTypeDraft] = useState('');
    const [budgetDraft, setBudgetDraft] = useState('');
    const [moveInDraft, setMoveInDraft] = useState('');
    const [preferencesDraft, setPreferencesDraft] = useState('');
    const [statusDraft, setStatusDraft] = useState('Visited');
    const [statusReasonDraft, setStatusReasonDraft] = useState('');
    const [savingField, setSavingField] = useState('');
    const [statusReasonError, setStatusReasonError] = useState('');
    const [pendingStatusChange, setPendingStatusChange] = useState(null);
    const [expandedMergeCandidateId, setExpandedMergeCandidateId] = useState('');
    const [mergeSubmittingId, setMergeSubmittingId] = useState('');
    const { authContext } = useAuth();

    const executeCRMTool = async (tool_name, parameters = {}) => {
        const response = await apiClient.post('/api/master_ai/tools/execute', {
            agent_name: 'CRMAgent',
            tool_name,
            parameters,
        });

        if (!response.success) {
            throw new Error(response.error || `Failed to execute ${tool_name}`);
        }
        return response.data;
    };

    const crmPermissions = authContext?.permissions?.admin_adapter?.CRMAgent || [];
    const canMergeLeads = crmPermissions.includes('merge_leads');

    const hydrateLead = async (leadId, { openDrawer = false } = {}) => {
        let lead = null;
        let leadTimeline = [];

        try {
            const details = await executeCRMTool('get_lead', { phone: leadId });
            lead = details?.lead || null;
            leadTimeline = Array.isArray(details?.timeline) ? [...details.timeline] : [];
        } catch (_err) {
            const fallbackLead = await executeCRMTool('get_lead_by_phone', { phone: leadId });
            lead = fallbackLead?.lead || null;
            if (lead?.lead_id) {
                const timelinePayload = await executeCRMTool('get_timeline', { lead_id: lead.lead_id, limit: 200 });
                leadTimeline = Array.isArray(timelinePayload?.events) ? [...timelinePayload.events] : [];
            }
        }

        leadTimeline.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

        let leadArtifacts = [];
        if (lead?.lead_id) {
            try {
                const artifactPayload = await executeCRMTool('get_lead_artifacts', { lead_id: lead.lead_id });
                leadArtifacts = Array.isArray(artifactPayload?.artifacts) ? artifactPayload.artifacts : [];
            } catch (_artifactErr) {
                leadArtifacts = [];
            }
        }

        const requirement = extractRequirement(lead || {});
        setSelectedLead(lead);
        setSelectedLeadId(lead?.lead_id || '');
        setTimeline(leadTimeline);
        setArtifacts(leadArtifacts);
        setEmailDraft(lead?.email || '');
        setProfileTypeDraft(lead?.profile_type || 'Customer');
        setSourceChannelDraft(lead?.source?.channel || '');
        setSourceDetailDraft(lead?.source?.detail || '');
        setSecondaryPhoneDraft('');
        setUnitTypeDraft(requirement.unitType === 'Not specified' ? '' : requirement.unitType);
        setBudgetDraft(requirement.budget === 'Not specified' ? '' : requirement.budget);
        setMoveInDraft(requirement.moveIn === 'Not specified' ? '' : requirement.moveIn);
        setPreferencesDraft(requirement.preferences === 'Not specified' ? '' : requirement.preferences);
        setStatusDraft(lead?.status || 'Enquiry');
        setStatusReasonDraft('');
        setStatusReasonError('');
        setActiveEditor('');
        if (openDrawer) {
            setDrawerOpen(true);
            setActiveTab('leads');
        }
    };

    const loadDashboard = async () => {
        setLoading(true);
        setError('');
        try {
            const activeLeadFilters = {
                limit: 100,
                ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
                ...(profileFilter !== 'ALL' ? { profile_type: profileFilter } : {}),
            };
            const [statsPayload, recentPayload, mergePayload] = await Promise.all([
                executeCRMTool('get_dashboard_stats', {}),
                executeCRMTool('get_recent_leads', activeLeadFilters),
                executeCRMTool('get_merge_candidates', { limit: 6 }).catch(() => ({ candidates: [] })),
            ]);

            const nextLeads = Array.isArray(recentPayload?.leads) ? recentPayload.leads : [];
            const nextStats = {
                total_leads: toNumber(statsPayload?.total_leads),
                enquiry: toNumber(statsPayload?.enquiry),
                visited: toNumber(statsPayload?.visited),
                onboarded: toNumber(statsPayload?.onboarded),
                left: toNumber(statsPayload?.left),
                pending_follow_up: toNumber(statsPayload?.pending_follow_up) || nextLeads.filter((lead) => lead.status === 'Enquiry' || lead.status === 'Visited').length,
            };

            setStats(nextStats);
            setLeads(nextLeads);
            setMergeCandidates(Array.isArray(mergePayload?.candidates) ? mergePayload.candidates : []);

            if (!selectedLeadId && nextLeads.length > 0) {
                await hydrateLead(nextLeads[0].lead_id, { openDrawer: false });
            } else if (selectedLeadId) {
                const stillPresent = nextLeads.find((lead) => lead.lead_id === selectedLeadId);
                if (!stillPresent) {
                    setDrawerOpen(false);
                    setSelectedLead(null);
                    setSelectedLeadId('');
                    setTimeline([]);
                    setArtifacts([]);
                }
            }
        } catch (err) {
            setError(err.message || 'Failed to load CRM dashboard.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const movementSeries = useMemo(() => buildMovementSeries(leads), [leads]);
    const funnelRows = useMemo(() => buildFunnelRows(stats), [stats]);
    const filteredTimeline = useMemo(() => {
        if (timelineFilter === 'ALL') return timeline;
        return timeline.filter((event) => event.type === timelineFilter);
    }, [timeline, timelineFilter]);
    const requirement = useMemo(() => extractRequirement(selectedLead || {}), [selectedLead]);
    const kycArtifacts = useMemo(() => artifacts.filter(isKycArtifact), [artifacts]);

    const handleSearch = async (event) => {
        event.preventDefault();
        setError('');
        try {
            const formData = new FormData(event.currentTarget);
            const submittedQuery = String(formData.get('crm_query') || '').trim();
            const submittedStatus = String(formData.get('crm_status') || statusFilter || 'ALL');
            const submittedProfile = String(formData.get('crm_profile') || profileFilter || 'ALL');
            setQuery(submittedQuery);
            setStatusFilter(submittedStatus);
            setProfileFilter(submittedProfile);

            const activeFilters = {
                limit: 100,
                ...(submittedStatus !== 'ALL' ? { status: submittedStatus } : {}),
                ...(submittedProfile !== 'ALL' ? { profile_type: submittedProfile } : {}),
            };
            if (!submittedQuery) {
                const recentPayload = await executeCRMTool('get_recent_leads', activeFilters);
                setLeads(Array.isArray(recentPayload?.leads) ? recentPayload.leads : []);
                setActiveTab('leads');
                return;
            }

            const result = await executeCRMTool('search_leads', {
                query: submittedQuery,
                offset: 0,
                ...activeFilters,
            });
            setLeads(Array.isArray(result?.leads) ? result.leads : []);
            setActiveTab('leads');
        } catch (err) {
            setError(err.message || 'Search failed.');
        }
    };

    const handleSaveSnapshot = async (editorKey, payload) => {
        if (!selectedLead?.lead_id) return;
        setError('');
        setSavingField(editorKey);
        try {
            await executeCRMTool('update_lead_snapshot', {
                lead_id: selectedLead.lead_id,
                ...payload,
            });
            await hydrateLead(selectedLead.lead_id, { openDrawer: true });
            await loadDashboard();
        } catch (err) {
            setError(err.message || 'Failed to update lead snapshot.');
        } finally {
            setSavingField('');
        }
    };

    const handleAddSecondaryPhone = async () => {
        if (!selectedLead?.lead_id || !secondaryPhoneDraft.trim()) return;
        setError('');
        setSavingField('secondary_phone');
        try {
            await executeCRMTool('add_secondary_phone', {
                lead_id: selectedLead.lead_id,
                phone_number: secondaryPhoneDraft.trim(),
                label: 'Secondary',
            });
            await hydrateLead(selectedLead.lead_id, { openDrawer: true });
            await loadDashboard();
        } catch (err) {
            setError(err.message || 'Failed to add secondary phone.');
        } finally {
            setSavingField('');
        }
    };

    const handleStatusChangeRequest = () => {
        if (!selectedLead?.lead_id) return;
        if (!String(statusReasonDraft || '').trim()) {
            setStatusReasonError('Reason is required for status change.');
            return;
        }
        setStatusReasonError('');
        setPendingStatusChange({
            lead_id: selectedLead.lead_id,
            to_status: statusDraft,
            reason: statusReasonDraft.trim(),
        });
    };

    const handleConfirmStatusChange = async () => {
        if (!pendingStatusChange) return;
        setSavingField('status');
        setError('');
        try {
            await executeCRMTool('change_status', pendingStatusChange);
            setPendingStatusChange(null);
            setStatusReasonDraft('');
            await hydrateLead(selectedLead.lead_id, { openDrawer: true });
            await loadDashboard();
        } catch (err) {
            setError(err.message || 'Failed to update lead status.');
        } finally {
            setSavingField('');
        }
    };

    const handleApproveMerge = async (candidate) => {
        if (!candidate?.source?.lead_id || !candidate?.target?.lead_id) return;
        setMergeSubmittingId(candidate.candidate_id);
        setError('');
        try {
            await executeCRMTool('merge_leads', {
                source_lead_id: candidate.source.lead_id,
                target_lead_id: candidate.target.lead_id,
                relationship: candidate.relationship || 'Duplicate',
            });
            setExpandedMergeCandidateId('');
            if (selectedLeadId === candidate.source.lead_id) {
                setDrawerOpen(false);
            }
            await loadDashboard();
        } catch (err) {
            setError(err.message || 'Failed to merge leads.');
        } finally {
            setMergeSubmittingId('');
        }
    };

    return (
        <div className="flex h-full flex-col bg-stone-50" data-testid="crm-console">
            <header className="shrink-0 border-b border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-900 p-3 text-white">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">CRM Overview</h1>
                        </div>
                    </div>
                    <button
                        onClick={loadDashboard}
                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50"
                        type="button"
                    >
                        Refresh
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-5">
                <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex flex-wrap gap-2">
                            {TAB_OPTIONS.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${activeTab === tab ? 'bg-slate-900 text-white' : 'border border-stone-200 bg-white text-slate-500'}`}
                                    data-testid={`crm-tab-${tab}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === 'overview' ? (
                        <div className="space-y-5">
                            <section className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                                <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                                    <div className="rounded-3xl border border-stone-200 bg-stone-100 p-4" data-testid="crm-kpi-total">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Leads</div>
                                        <div className="mt-3 text-4xl font-bold tracking-tight text-stone-800">{stats.total_leads}</div>
                                    </div>
                                    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4" data-testid="crm-kpi-enquiry">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Enquiry</div>
                                        <div className="mt-3 text-4xl font-bold tracking-tight text-sky-800">{stats.enquiry}</div>
                                    </div>
                                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4" data-testid="crm-kpi-visited">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Visited</div>
                                        <div className="mt-3 text-4xl font-bold tracking-tight text-amber-800">{stats.visited}</div>
                                    </div>
                                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4" data-testid="crm-kpi-onboarded">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Onboarded</div>
                                        <div className="mt-3 text-4xl font-bold tracking-tight text-emerald-800">{stats.onboarded}</div>
                                    </div>
                                    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4" data-testid="crm-kpi-left">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Left</div>
                                        <div className="mt-3 text-4xl font-bold tracking-tight text-rose-800">{stats.left}</div>
                                    </div>
                                    <div className="rounded-3xl border border-slate-200 bg-slate-100 p-4" data-testid="crm-kpi-pending-follow-up">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Pending Follow-up</div>
                                        <div className="mt-3 text-4xl font-bold tracking-tight text-slate-700">{stats.pending_follow_up}</div>
                                    </div>
                                </div>

                                <div className="grid gap-4 xl:grid-cols-2">
                                    <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                                        <div className="mb-4 text-lg font-semibold text-slate-900">Lead movement by day</div>
                                        <div className="flex h-64 items-end gap-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-6">
                                            {movementSeries.length === 0 ? (
                                                <div className="text-sm text-slate-500">Not enough recent lead activity to draw movement yet.</div>
                                            ) : movementSeries.map((entry) => {
                                                const maxCount = Math.max(...movementSeries.map((row) => row.total), 1);
                                                return (
                                                    <div key={entry.date} className="flex flex-1 flex-col items-center gap-2">
                                                        <div className="flex h-44 items-end gap-1">
                                                            <div className="w-4 rounded-t-full bg-sky-200" style={{ height: `${Math.max(8, (entry.enquiry / maxCount) * 100)}%` }} />
                                                            <div className="w-4 rounded-t-full bg-amber-200" style={{ height: `${Math.max(8, (entry.visited / maxCount) * 100)}%` }} />
                                                            <div className="w-4 rounded-t-full bg-emerald-200" style={{ height: `${Math.max(8, (entry.onboarded / maxCount) * 100)}%` }} />
                                                        </div>
                                                        <div className="text-xs font-semibold text-slate-500">{entry.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                                        <div className="mb-4 text-lg font-semibold text-slate-900">Funnel trend</div>
                                        <div className="space-y-4 rounded-[20px] border border-stone-200 bg-stone-50 p-5">
                                            {funnelRows.map((row) => (
                                                <div key={row.key}>
                                                    <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
                                                        <span>{row.label}</span>
                                                        <span>{row.count}</span>
                                                    </div>
                                                    <div className="h-4 rounded-full bg-white">
                                                        <div className={`h-4 rounded-full ${row.color}`} style={{ width: `${row.width}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Merge Queue</h2>
                                        <p className="mt-1 text-sm text-slate-500">System-flagged candidates for CEO review. Staff can inspect, but only CEO can approve.</p>
                                    </div>
                                    <div className="rounded-full bg-violet-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">CEO approval required</div>
                                </div>

                                <div className="space-y-3" data-testid="crm-merge-queue">
                                    {!loading && mergeCandidates.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-slate-500">No system-flagged merge candidates right now.</div>
                                    ) : null}

                                    {mergeCandidates.map((candidate) => {
                                        const expanded = expandedMergeCandidateId === candidate.candidate_id;
                                        return (
                                            <div key={candidate.candidate_id} className="rounded-3xl border border-stone-200 bg-white p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-xl font-semibold text-slate-900">{candidate.source?.name || 'Unknown'} / {candidate.target?.name || 'Unknown'}</div>
                                                        <div className="mt-1 text-sm text-slate-500">{candidate.source?.lead_id} {'->'} {candidate.target?.lead_id}</div>
                                                        <div className="mt-3 text-sm text-slate-600">{Array.isArray(candidate.reasons) && candidate.reasons.length > 0 ? candidate.reasons.join(' • ') : 'Possible duplicate identity detected.'}</div>
                                                    </div>
                                                    <div className="rounded-full bg-violet-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Confidence {candidate.confidence}%</div>
                                                </div>
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedMergeCandidateId(expanded ? '' : candidate.candidate_id)}
                                                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-stone-50"
                                                        data-testid={`crm-merge-open-${candidate.candidate_id}`}
                                                    >
                                                        Open Comparison
                                                    </button>
                                                    {expanded ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApproveMerge(candidate)}
                                                            disabled={!canMergeLeads || mergeSubmittingId === candidate.candidate_id}
                                                            className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500"
                                                            data-testid={`crm-merge-approve-${candidate.candidate_id}`}
                                                        >
                                                            {mergeSubmittingId === candidate.candidate_id ? 'Approving...' : 'Approve'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                                {expanded ? (
                                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                                        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                                                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Source Lead</div>
                                                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                                                <div><strong>Name:</strong> {candidate.source?.name || 'Unknown'}</div>
                                                                <div><strong>Phone:</strong> {candidate.source?.lead_id}</div>
                                                                <div><strong>Email:</strong> {candidate.source?.email || 'Not specified'}</div>
                                                                <div><strong>Status:</strong> {candidate.source?.status || 'Unknown'}</div>
                                                                <div><strong>Source:</strong> {formatSource(candidate.source?.source)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                                                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Target Lead</div>
                                                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                                                <div><strong>Name:</strong> {candidate.target?.name || 'Unknown'}</div>
                                                                <div><strong>Phone:</strong> {candidate.target?.lead_id}</div>
                                                                <div><strong>Email:</strong> {candidate.target?.email || 'Not specified'}</div>
                                                                <div><strong>Status:</strong> {candidate.target?.status || 'Unknown'}</div>
                                                                <div><strong>Source:</strong> {formatSource(candidate.target?.source)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                {expanded && !canMergeLeads ? <div className="mt-3 text-sm text-amber-700">CEO role required to approve the merge from GUI.</div> : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    ) : (
                        <section className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Leads</h2>
                                    <p className="mt-1 text-sm text-slate-500">Search and open a lead. The profile opens in a right drawer.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_180px]" data-testid="crm-leads-search-row">
                                <input
                                    name="crm_query"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by phone / name / email"
                                    className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-500"
                                    data-testid="crm-search-input"
                                />
                                <select
                                    name="crm_status"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-500"
                                    data-testid="crm-status-filter"
                                >
                                    {LEAD_STATUS_FILTER_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                            {status === 'ALL' ? 'Status: All' : status}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    name="crm_profile"
                                    value={profileFilter}
                                    onChange={(e) => setProfileFilter(e.target.value)}
                                    className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-500"
                                    data-testid="crm-profile-filter"
                                >
                                    {PROFILE_FILTER_OPTIONS.map((profile) => (
                                        <option key={profile} value={profile}>
                                            {profile === 'ALL' ? 'Profile: All' : profile}
                                        </option>
                                    ))}
                                </select>
                                <button type="submit" className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-stone-100" data-testid="crm-search-btn">
                                    Search
                                </button>
                            </form>

                            <div className="relative mt-5 min-h-[760px] overflow-hidden rounded-[24px] border border-stone-200 bg-white">
                                <div className="grid h-full lg:grid-cols-[360px_1fr]">
                                    <div className="border-r border-stone-200">
                                        <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3 text-sm font-semibold text-slate-600">
                                            <Search className="h-4 w-4" /> Lead Search Results
                                        </div>
                                        <div className="max-h-[700px] overflow-auto">
                                            {loading ? <p className="p-4 text-sm text-slate-500">Loading leads...</p> : null}
                                            {!loading && leads.length === 0 ? <p className="p-4 text-sm text-slate-500">No leads found.</p> : null}
                                            {!loading && leads.map((lead) => (
                                                <button
                                                    key={lead.lead_id}
                                                    type="button"
                                                    onClick={() => hydrateLead(lead.lead_id, { openDrawer: true })}
                                                    className={`w-full border-b border-stone-100 px-4 py-4 text-left hover:bg-stone-50 ${selectedLeadId === lead.lead_id ? 'bg-stone-50' : 'bg-white'}`}
                                                    data-testid={`crm-lead-${lead.lead_id}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-base font-semibold text-slate-900">{lead.name || 'Unknown'}</div>
                                                            <div className="mt-1 text-xs text-slate-500">{lead.lead_id}</div>
                                                        </div>
                                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassForStatus(lead.status)}`}>
                                                            {lead.status || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 text-xs text-slate-500">{formatSource(lead.source)}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="hidden lg:flex items-center justify-center bg-stone-50 p-10 text-center text-sm text-slate-500">
                                        {drawerOpen && selectedLead ? 'Lead profile is open in the drawer.' : 'Select a lead from the list to open the profile drawer.'}
                                    </div>
                                </div>

                                {drawerOpen && selectedLead ? (
                                    <aside className="absolute inset-y-0 right-0 z-10 w-full overflow-auto border-l border-stone-200 bg-white shadow-2xl lg:w-[68%]" data-testid="crm-lead-detail">
                                        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white px-5 py-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Customer Profile</div>
                                                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900" data-testid="crm-lead-name">{selectedLead.name || 'Unknown'}</h3>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1"><Phone className="h-4 w-4" /> {selectedLead.lead_id}</span>
                                                        {selectedLead.email ? <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1"><Mail className="h-4 w-4" /> {selectedLead.email}</span> : null}
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1"><Clock3 className="h-4 w-4" /> {formatSource(selectedLead.source)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDrawerOpen(false)}
                                                        className="rounded-full border border-stone-300 bg-white p-2 text-slate-500 hover:bg-stone-50"
                                                        aria-label="Close lead drawer"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveEditor(activeEditor === 'status' ? '' : 'status')}
                                                        className={`rounded-full border px-4 py-2 text-xl font-semibold ${toneClassForStatus(selectedLead.status)}`}
                                                        data-testid="crm-status-trigger"
                                                    >
                                                        {selectedLead.status || 'Unknown'} &#9662;
                                                    </button>
                                                </div>
                                            </div>
                                            {activeEditor === 'status' ? (
                                                <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                                                    <div className="grid gap-3 lg:grid-cols-[180px_1fr_160px]">
                                                        <select
                                                            value={statusDraft}
                                                            onChange={(e) => setStatusDraft(e.target.value)}
                                                            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                                                            data-testid="crm-status-select"
                                                        >
                                                            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                                                        </select>
                                                        <input
                                                            value={statusReasonDraft}
                                                            onChange={(e) => {
                                                                setStatusReasonDraft(e.target.value);
                                                                if (statusReasonError) setStatusReasonError('');
                                                            }}
                                                            placeholder="Reason (required)"
                                                            className={`rounded-xl border px-3 py-2 text-sm ${statusReasonError ? 'border-rose-400 bg-rose-50' : 'border-stone-300 bg-white'}`}
                                                            data-testid="crm-status-reason"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleStatusChangeRequest}
                                                            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                                                            data-testid="crm-status-save"
                                                        >
                                                            Confirm
                                                        </button>
                                                    </div>
                                                    {statusReasonError ? <p className="mt-2 text-sm text-rose-600" data-testid="crm-status-reason-error">{statusReasonError}</p> : null}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="space-y-5 p-5">
                                            <div className="grid gap-5 xl:grid-cols-2">
                                                <section className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                                                    <h4 className="mb-4 text-xl font-semibold text-slate-900">Profile</h4>

                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3 border-b border-stone-200 pb-3">
                                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name</div>
                                                            <div className="text-base text-slate-900">{selectedLead.name || 'Unknown'}</div>
                                                            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Locked</span>
                                                        </div>

                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</div>
                                                                <div className="text-base text-slate-900">{selectedLead.email || 'Not specified'}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'email' ? '' : 'email')} active={activeEditor === 'email'} testId="crm-email-toggle" />
                                                            </div>
                                                            {activeEditor === 'email' ? (
                                                                <div className="mt-3 flex gap-2">
                                                                    <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" data-testid="crm-email-input" />
                                                                    <button type="button" onClick={() => handleSaveSnapshot('email', { email: emailDraft.trim() })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'email'} data-testid="crm-email-save">{savingField === 'email' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Profile Type</div>
                                                                <div className="text-base text-slate-900">{selectedLead.profile_type || 'Customer'}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'profile_type' ? '' : 'profile_type')} active={activeEditor === 'profile_type'} testId="crm-profile-type-toggle" />
                                                            </div>
                                                            {activeEditor === 'profile_type' ? (
                                                                <div className="mt-3 flex gap-2">
                                                                    <select value={profileTypeDraft} onChange={(e) => setProfileTypeDraft(e.target.value)} className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
                                                                        <option value="Customer">Customer</option>
                                                                        <option value="Staff">Staff</option>
                                                                        <option value="CEO">CEO</option>
                                                                    </select>
                                                                    <button type="button" onClick={() => handleSaveSnapshot('profile_type', { profile_type: profileTypeDraft })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'profile_type'}>{savingField === 'profile_type' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3 border-b border-stone-200 pb-3">
                                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Primary Phone</div>
                                                            <div className="text-base text-slate-900">{selectedLead.lead_id}</div>
                                                            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Locked</span>
                                                        </div>

                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Secondary Phone</div>
                                                                <div className="text-base text-slate-900">{Array.isArray(selectedLead.phones?.others) && selectedLead.phones.others.length > 0 ? selectedLead.phones.others.map((entry) => entry.number).join(', ') : 'None'}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'secondary_phone' ? '' : 'secondary_phone')} active={activeEditor === 'secondary_phone'} testId="crm-secondary-phone-toggle" />
                                                            </div>
                                                            {activeEditor === 'secondary_phone' ? (
                                                                <div className="mt-3 flex gap-2">
                                                                    <input value={secondaryPhoneDraft} onChange={(e) => setSecondaryPhoneDraft(e.target.value)} placeholder="+9199..." className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" data-testid="crm-secondary-phone-input" />
                                                                    <button type="button" onClick={handleAddSecondaryPhone} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'secondary_phone'} data-testid="crm-secondary-phone-save">{savingField === 'secondary_phone' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Source</div>
                                                                <div className="text-base text-slate-900">{formatSource(selectedLead.source)}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'source' ? '' : 'source')} active={activeEditor === 'source'} testId="crm-source-toggle" />
                                                            </div>
                                                            {activeEditor === 'source' ? (
                                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                                    <input value={sourceChannelDraft} onChange={(e) => setSourceChannelDraft(e.target.value)} placeholder="Channel" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                                                                    <input value={sourceDetailDraft} onChange={(e) => setSourceDetailDraft(e.target.value)} placeholder="Detail" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                                                                    <button type="button" onClick={() => handleSaveSnapshot('source', { source: { ...(selectedLead.source || {}), channel: sourceChannelDraft.trim(), detail: sourceDetailDraft.trim() } })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white md:col-span-2" disabled={savingField === 'source'}>{savingField === 'source' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="grid grid-cols-[140px_1fr_auto] items-start gap-3 border-b border-stone-200 pb-3">
                                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">AI Notes</div>
                                                            <div className="text-base text-slate-900">{selectedLead.ai_notes ? JSON.stringify(selectedLead.ai_notes) : 'No snapshot AI notes yet.'}</div>
                                                            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Snapshot</span>
                                                        </div>

                                                        <div>
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-start gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">KYC</div>
                                                                <div className="space-y-2 text-base text-slate-900">
                                                                    {kycArtifacts.length === 0 ? 'No linked KYC documents yet.' : kycArtifacts.map((artifact) => (
                                                                        <a key={`${artifact.url}-${artifact.date}`} href={artifact.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50">{artifact.description || artifact.type || artifact.url}</a>
                                                                    ))}
                                                                </div>
                                                                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Links</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                                                    <h4 className="mb-4 text-xl font-semibold text-slate-900">Requirement</h4>
                                                    <div className="space-y-4">
                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Unit Type</div>
                                                                <div className="text-base text-slate-900">{requirement.unitType}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'unit_type' ? '' : 'unit_type')} active={activeEditor === 'unit_type'} testId="crm-unit-type-toggle" />
                                                            </div>
                                                            {activeEditor === 'unit_type' ? (
                                                                <div className="mt-3 flex gap-2">
                                                                    <input value={unitTypeDraft} onChange={(e) => setUnitTypeDraft(e.target.value)} className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                                                                    <button type="button" onClick={() => handleSaveSnapshot('unit_type', { demographics: { ...(selectedLead.demographics || {}), unit_type_required: unitTypeDraft.trim() } })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'unit_type'}>{savingField === 'unit_type' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Budget</div>
                                                                <div className="text-base text-slate-900">{requirement.budget}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'budget' ? '' : 'budget')} active={activeEditor === 'budget'} testId="crm-budget-toggle" />
                                                            </div>
                                                            {activeEditor === 'budget' ? (
                                                                <div className="mt-3 flex gap-2">
                                                                    <input value={budgetDraft} onChange={(e) => setBudgetDraft(e.target.value)} className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                                                                    <button type="button" onClick={() => handleSaveSnapshot('budget', { demographics: { ...(selectedLead.demographics || {}), budget: budgetDraft.trim() } })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'budget'}>{savingField === 'budget' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="border-b border-stone-200 pb-3">
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Move-in</div>
                                                                <div className="text-base text-slate-900">{requirement.moveIn}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'move_in' ? '' : 'move_in')} active={activeEditor === 'move_in'} testId="crm-move-in-toggle" />
                                                            </div>
                                                            {activeEditor === 'move_in' ? (
                                                                <div className="mt-3 flex gap-2">
                                                                    <input value={moveInDraft} onChange={(e) => setMoveInDraft(e.target.value)} className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                                                                    <button type="button" onClick={() => handleSaveSnapshot('move_in', { demographics: { ...(selectedLead.demographics || {}), move_in: moveInDraft.trim() } })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'move_in'}>{savingField === 'move_in' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div>
                                                            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Preferences</div>
                                                                <div className="text-base text-slate-900">{requirement.preferences}</div>
                                                                <InlineTriangleButton onClick={() => setActiveEditor(activeEditor === 'preferences' ? '' : 'preferences')} active={activeEditor === 'preferences'} testId="crm-preferences-toggle" />
                                                            </div>
                                                            {activeEditor === 'preferences' ? (
                                                                <div className="mt-3 grid gap-2">
                                                                    <textarea value={preferencesDraft} onChange={(e) => setPreferencesDraft(e.target.value)} rows={3} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                                                                    <button type="button" onClick={() => handleSaveSnapshot('preferences', { preferences: preferencesDraft.split(',').map((item) => item.trim()).filter(Boolean) })} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white justify-self-start" disabled={savingField === 'preferences'}>{savingField === 'preferences' ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </section>
                                            </div>

                                            <section className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                                                <div className="mb-4 flex items-center justify-between gap-3">
                                                    <div>
                                                        <h4 className="text-xl font-semibold text-slate-900">Session Timeline</h4>
                                                        <p className="mt-1 text-sm text-slate-500">Read history first. Status remains a convenience field backed by timeline events.</p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                                        <Filter className="h-4 w-4 text-slate-500" />
                                                        {TIMELINE_FILTERS.map((type) => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => setTimelineFilter(type)}
                                                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${timelineFilter === type ? 'border-slate-900 bg-slate-900 text-white' : 'border-stone-200 bg-white text-slate-600'}`}
                                                                data-testid={`crm-filter-${type}`}
                                                            >
                                                                {type === 'ALL' ? 'All' : type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-3" data-testid="crm-timeline-list">
                                                    {filteredTimeline.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-slate-500">No timeline events.</div> : null}
                                                    {filteredTimeline.map((event) => (
                                                        <article key={event.event_id || `${event.type}-${event.timestamp}`} className="rounded-2xl border border-stone-200 bg-white p-4" data-testid="crm-timeline-event">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{event.type}</div>
                                                                    <div className="mt-1 text-sm text-slate-500">{formatTimestamp(event.timestamp)}</div>
                                                                </div>
                                                                {event.type === 'SESSION' ? (
                                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                                        {event.sentiment ? <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-700">{event.sentiment}</span> : null}
                                                                        {event.tone ? <span className="rounded-full bg-stone-100 px-3 py-1 font-semibold text-stone-700">{event.tone}</span> : null}
                                                                        {event.financial_impact ? <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">Financial: {event.financial_impact}</span> : null}
                                                                        {event.compliance_impact ? <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Compliance: {event.compliance_impact}</span> : null}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="mt-3 text-sm leading-6 text-slate-700">{renderEventMeta(event)}</div>
                                                        </article>
                                                    ))}
                                                </div>
                                            </section>
                                        </div>
                                    </aside>
                                ) : null}
                            </div>
                        </section>
                    )}
                </section>
            </div>

            {pendingStatusChange ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="crm-status-confirm-modal">
                    <div className="w-full max-w-lg rounded-[28px] border border-stone-200 bg-white p-6 shadow-2xl">
                        <h3 className="text-xl font-semibold text-slate-900">Confirm status change</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            Move <strong>{selectedLead?.name || 'this lead'}</strong> to <strong>{pendingStatusChange.to_status}</strong> with reason <strong>{pendingStatusChange.reason}</strong>?
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setPendingStatusChange(null)} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" data-testid="crm-status-confirm-cancel">Cancel</button>
                            <button type="button" onClick={handleConfirmStatusChange} className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={savingField === 'status'} data-testid="crm-status-confirm-yes">{savingField === 'status' ? 'Updating...' : 'Yes, update'}</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default CRMConsole;
