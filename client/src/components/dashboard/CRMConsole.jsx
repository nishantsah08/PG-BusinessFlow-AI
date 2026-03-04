import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Phone, Mail, Clock3, Filter } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const TIMELINE_FILTERS = ['ALL', 'SESSION', 'STATUS_CHANGE', 'NOTE', 'MERGE', 'ARTIFACT_LINKED'];

const emptyStats = {
    total_leads: 0,
    enquiry: 0,
    visited: 0,
    onboarded: 0,
    left: 0,
};

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const CRMConsole = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState(emptyStats);
    const [query, setQuery] = useState('');
    const [leads, setLeads] = useState([]);
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [selectedLead, setSelectedLead] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [timelineFilter, setTimelineFilter] = useState('ALL');
    const [emailDraft, setEmailDraft] = useState('');
    const [savingEmail, setSavingEmail] = useState(false);
    const [statusDraft, setStatusDraft] = useState('Visited');
    const [statusReasonDraft, setStatusReasonDraft] = useState('');
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [secondaryPhoneDraft, setSecondaryPhoneDraft] = useState('');
    const [phoneAdding, setPhoneAdding] = useState(false);
    const [statusReasonError, setStatusReasonError] = useState('');
    const [pendingStatusChange, setPendingStatusChange] = useState(null);
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

    const hydrateLead = async (leadId) => {
        const details = await executeCRMTool('get_lead', { phone: leadId });
        const lead = details?.lead || null;
        const leadTimeline = Array.isArray(details?.timeline) ? [...details.timeline] : [];
        leadTimeline.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        setSelectedLead(lead);
        setEmailDraft(lead?.email || '');
        setStatusDraft(lead?.status || 'Enquiry');
        setTimeline(leadTimeline);
    };

    const loadDashboard = async () => {
        setLoading(true);
        setError('');
        try {
            const [statsPayload, recentPayload] = await Promise.all([
                executeCRMTool('get_dashboard_stats', {}),
                executeCRMTool('get_recent_leads', { limit: 25 }),
            ]);

            const nextStats = {
                total_leads: toNumber(statsPayload?.total_leads),
                enquiry: toNumber(statsPayload?.enquiry),
                visited: toNumber(statsPayload?.visited),
                onboarded: toNumber(statsPayload?.onboarded),
                left: toNumber(statsPayload?.left),
            };

            const nextLeads = Array.isArray(recentPayload?.leads) ? recentPayload.leads : [];
            setStats(nextStats);
            setLeads(nextLeads);

            if (nextLeads.length > 0) {
                const firstLeadId = nextLeads[0].lead_id;
                setSelectedLeadId(firstLeadId);
                await hydrateLead(firstLeadId);
            } else {
                setSelectedLeadId('');
                setSelectedLead(null);
                setTimeline([]);
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

    const crmPermissions = authContext?.permissions?.admin_adapter?.CRMAgent || [];
    const canMergeLeads = crmPermissions.includes('merge_leads');
    const canArchiveLead = crmPermissions.includes('archive_lead');

    const handleSearch = async (event) => {
        event.preventDefault();
        setError('');

        try {
            if (!query.trim()) {
                const recentPayload = await executeCRMTool('get_recent_leads', { limit: 25 });
                setLeads(Array.isArray(recentPayload?.leads) ? recentPayload.leads : []);
                return;
            }

            const result = await executeCRMTool('search_leads', {
                query: query.trim(),
                limit: 25,
                offset: 0,
            });
            setLeads(Array.isArray(result?.leads) ? result.leads : []);
        } catch (err) {
            setError(err.message || 'Search failed.');
        }
    };

    const filteredTimeline = useMemo(() => {
        if (timelineFilter === 'ALL') return timeline;
        return timeline.filter((event) => event.type === timelineFilter);
    }, [timeline, timelineFilter]);

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

    const handleSaveEmail = async () => {
        if (!selectedLead?.lead_id) return;
        setError('');
        setSavingEmail(true);
        try {
            await executeCRMTool('update_lead_snapshot', {
                lead_id: selectedLead.lead_id,
                email: emailDraft.trim(),
            });
            await hydrateLead(selectedLead.lead_id);
        } catch (err) {
            setError(err.message || 'Failed to update lead email.');
        } finally {
            setSavingEmail(false);
        }
    };

    const handleChangeStatusRequest = async () => {
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
        setError('');
        setStatusUpdating(true);
        try {
            await executeCRMTool('change_status', pendingStatusChange);
            setStatusReasonDraft('');
            setPendingStatusChange(null);
            await Promise.all([loadDashboard(), hydrateLead(selectedLead.lead_id)]);
        } catch (err) {
            setError(err.message || 'Failed to update lead status.');
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleAddManualNote = async () => {
        if (!selectedLead?.lead_id) return;
        if (!String(noteDraft || '').trim()) {
            setError('Note content is required.');
            return;
        }
        setError('');
        setNoteSaving(true);
        try {
            await executeCRMTool('add_manual_note', {
                lead_id: selectedLead.lead_id,
                content: noteDraft.trim(),
                author: 'admin_gui',
            });
            setNoteDraft('');
            await hydrateLead(selectedLead.lead_id);
        } catch (err) {
            setError(err.message || 'Failed to add note.');
        } finally {
            setNoteSaving(false);
        }
    };

    const handleAddSecondaryPhone = async () => {
        if (!selectedLead?.lead_id) return;
        if (!String(secondaryPhoneDraft || '').trim()) {
            setError('Secondary phone is required.');
            return;
        }
        setError('');
        setPhoneAdding(true);
        try {
            await executeCRMTool('add_secondary_phone', {
                lead_id: selectedLead.lead_id,
                phone_number: secondaryPhoneDraft.trim(),
                label: 'Secondary',
            });
            setSecondaryPhoneDraft('');
            await hydrateLead(selectedLead.lead_id);
        } catch (err) {
            setError(err.message || 'Failed to add secondary phone.');
        } finally {
            setPhoneAdding(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50" data-testid="crm-console">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-indigo-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">CRM Lead 360</h1>
                        <p className="text-sm text-gray-500">Snapshot + append-only timeline for every lead</p>
                    </div>
                </div>
                <button
                    onClick={loadDashboard}
                    className="text-sm px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100"
                    type="button"
                >
                    Refresh
                </button>
            </header>

            <div className="border-b border-gray-200 bg-white px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                <div className="rounded-lg border p-3" data-testid="crm-kpi-total">
                    <div className="text-xs text-gray-500">Total Leads</div>
                    <div className="text-xl font-semibold">{stats.total_leads}</div>
                </div>
                <div className="rounded-lg border p-3" data-testid="crm-kpi-enquiry">
                    <div className="text-xs text-gray-500">Enquiry</div>
                    <div className="text-xl font-semibold">{stats.enquiry}</div>
                </div>
                <div className="rounded-lg border p-3" data-testid="crm-kpi-visited">
                    <div className="text-xs text-gray-500">Visited</div>
                    <div className="text-xl font-semibold">{stats.visited}</div>
                </div>
                <div className="rounded-lg border p-3" data-testid="crm-kpi-onboarded">
                    <div className="text-xs text-gray-500">Onboarded</div>
                    <div className="text-xl font-semibold">{stats.onboarded}</div>
                </div>
                <div className="rounded-lg border p-3" data-testid="crm-kpi-left">
                    <div className="text-xs text-gray-500">Left</div>
                    <div className="text-xl font-semibold">{stats.left}</div>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4 p-4 overflow-hidden">
                <section className="bg-white border border-gray-200 rounded-xl flex flex-col min-h-0">
                    <div className="p-4 border-b border-gray-100">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search name, email, phone"
                                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                                data-testid="crm-search-input"
                            />
                            <button type="submit" className="px-3 py-2 border rounded-md hover:bg-gray-100" data-testid="crm-search-btn">
                                <Search className="w-4 h-4" />
                            </button>
                        </form>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {loading && <p className="text-sm text-gray-500 p-4">Loading leads...</p>}
                        {!loading && leads.length === 0 && <p className="text-sm text-gray-500 p-4">No leads found.</p>}
                        {!loading && leads.map((lead) => (
                            <button
                                key={lead.lead_id}
                                type="button"
                                onClick={async () => {
                                    setSelectedLeadId(lead.lead_id);
                                    await hydrateLead(lead.lead_id);
                                }}
                                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${selectedLeadId === lead.lead_id ? 'bg-indigo-50' : ''}`}
                                data-testid={`crm-lead-${lead.lead_id}`}
                            >
                                <div className="text-sm font-semibold text-gray-900">{lead.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-600 mt-0.5">{lead.lead_id}</div>
                                <div className="text-xs mt-1 inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    {lead.status || 'Unknown'}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="bg-white border border-gray-200 rounded-xl flex flex-col min-h-0" data-testid="crm-lead-detail">
                    {error ? <p className="text-sm text-red-600 p-4">{error}</p> : null}
                    {!selectedLead && !loading && !error ? (
                        <p className="text-sm text-gray-500 p-4">Select a lead to view profile and history.</p>
                    ) : null}

                    {selectedLead ? (
                        <>
                            <div className="p-4 border-b border-gray-100 space-y-2">
                                <h2 className="text-lg font-semibold text-gray-900" data-testid="crm-lead-name">{selectedLead.name || 'Unknown'}</h2>
                                <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                                    <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4" /> {selectedLead.lead_id}</span>
                                    {selectedLead.email ? <span className="inline-flex items-center gap-1"><Mail className="w-4 h-4" /> {selectedLead.email}</span> : null}
                                    <span className="inline-flex items-center gap-1"><Clock3 className="w-4 h-4" /> {selectedLead.status || 'Unknown'}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                                    <div><strong>Profile:</strong> {selectedLead.profile_type || 'Customer'}</div>
                                    <div><strong>Unit Need:</strong> {selectedLead.unit_type_required || 'Not specified'}</div>
                                    <div><strong>Source:</strong> {selectedLead.source?.channel || selectedLead.source?.detail || 'Not specified'}</div>
                                    <div><strong>Other Phones:</strong> {Array.isArray(selectedLead.phones?.others) && selectedLead.phones.others.length > 0 ? selectedLead.phones.others.map((p) => p.number).join(', ') : 'None'}</div>
                                </div>
                                <div className="pt-2 border-t border-gray-100">
                                    <label htmlFor="crm-email-edit" className="text-xs font-semibold text-gray-700">Editable Snapshot Field: Email</label>
                                    <div className="mt-1 flex gap-2">
                                        <input
                                            id="crm-email-edit"
                                            type="email"
                                            value={emailDraft}
                                            onChange={(e) => setEmailDraft(e.target.value)}
                                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                                            placeholder="lead@email.com"
                                            data-testid="crm-email-input"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSaveEmail}
                                            disabled={savingEmail}
                                            className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-60"
                                            data-testid="crm-email-save"
                                        >
                                            {savingEmail ? 'Saving...' : 'Save Email'}
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-gray-100 space-y-2">
                                    <div className="text-xs font-semibold text-gray-700">Admin Actions</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="border border-gray-200 rounded-md p-2 space-y-2">
                                            <div className="text-xs font-medium text-gray-700">Change Status</div>
                                            <select
                                                value={statusDraft}
                                                onChange={(e) => setStatusDraft(e.target.value)}
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                data-testid="crm-status-select"
                                            >
                                                <option value="Enquiry">Enquiry</option>
                                                <option value="Visited">Visited</option>
                                                <option value="Onboarded">Onboarded</option>
                                                <option value="Left">Left</option>
                                            </select>
                                            <input
                                                value={statusReasonDraft}
                                                onChange={(e) => {
                                                    setStatusReasonDraft(e.target.value);
                                                    if (statusReasonError) setStatusReasonError('');
                                                }}
                                                placeholder="Reason (required)"
                                                className={`w-full border rounded-md px-2 py-1.5 text-sm ${statusReasonError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                                data-testid="crm-status-reason"
                                            />
                                            {statusReasonError ? (
                                                <p className="text-xs text-red-600" data-testid="crm-status-reason-error">{statusReasonError}</p>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={handleChangeStatusRequest}
                                                disabled={statusUpdating}
                                                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-60"
                                                data-testid="crm-status-save"
                                            >
                                                {statusUpdating ? 'Updating...' : 'Update Status'}
                                            </button>
                                        </div>
                                        <div className="border border-gray-200 rounded-md p-2 space-y-2">
                                            <div className="text-xs font-medium text-gray-700">Add Manual Note</div>
                                            <textarea
                                                value={noteDraft}
                                                onChange={(e) => setNoteDraft(e.target.value)}
                                                placeholder="Write note"
                                                rows={3}
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-none"
                                                data-testid="crm-note-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddManualNote}
                                                disabled={noteSaving}
                                                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-60"
                                                data-testid="crm-note-save"
                                            >
                                                {noteSaving ? 'Saving...' : 'Add Note'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="border border-gray-200 rounded-md p-2 space-y-2">
                                        <div className="text-xs font-medium text-gray-700">Add Secondary Phone</div>
                                        <div className="flex gap-2">
                                            <input
                                                value={secondaryPhoneDraft}
                                                onChange={(e) => setSecondaryPhoneDraft(e.target.value)}
                                                placeholder="+9199..."
                                                className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                data-testid="crm-secondary-phone-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddSecondaryPhone}
                                                disabled={phoneAdding}
                                                className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-60"
                                                data-testid="crm-secondary-phone-save"
                                            >
                                                {phoneAdding ? 'Adding...' : 'Add Phone'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="border border-gray-200 rounded-md p-2 space-y-2">
                                        <div className="text-xs font-medium text-gray-700">Restricted Actions (CEO only)</div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={!canMergeLeads}
                                                className="px-3 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                data-testid="crm-merge-action"
                                                title={canMergeLeads ? 'Available for your role' : 'Only CEO can use this action'}
                                            >
                                                Merge Leads
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!canArchiveLead}
                                                className="px-3 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                data-testid="crm-archive-action"
                                                title={canArchiveLead ? 'Available for your role' : 'Only CEO can use this action'}
                                            >
                                                Archive Lead
                                            </button>
                                        </div>
                                        {!canMergeLeads || !canArchiveLead ? (
                                            <p className="text-xs text-amber-700">CEO role required for merge/archive actions.</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-sm">
                                <Filter className="w-4 h-4 text-gray-500" />
                                {TIMELINE_FILTERS.map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setTimelineFilter(type)}
                                        className={`px-2 py-1 rounded-md border text-xs ${timelineFilter === type ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-700 border-gray-200'}`}
                                        data-testid={`crm-filter-${type}`}
                                    >
                                        {type === 'ALL' ? 'All' : type}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-auto p-4 space-y-3" data-testid="crm-timeline-list">
                                {filteredTimeline.length === 0 ? <p className="text-sm text-gray-500">No timeline events.</p> : null}
                                {filteredTimeline.map((event) => (
                                    <article key={event.event_id} className="border border-gray-200 rounded-lg p-3" data-testid="crm-timeline-event">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                                {event.type || 'EVENT'}
                                            </span>
                                            <span className="text-xs text-gray-500">{event.timestamp || 'Unknown time'}</span>
                                        </div>
                                        <p className="text-sm text-gray-800 mt-2 break-words">{renderEventMeta(event)}</p>
                                    </article>
                                ))}
                            </div>
                        </>
                    ) : null}
                </section>
            </div>

            {pendingStatusChange ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" data-testid="crm-status-confirm-modal">
                    <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 p-4">
                        <h3 className="text-base font-semibold text-gray-900">Confirm Status Change</h3>
                        <p className="mt-2 text-sm text-gray-700">
                            Update lead to <strong>{pendingStatusChange.to_status}</strong> with reason:
                        </p>
                        <p className="mt-1 text-sm text-gray-600 break-words">"{pendingStatusChange.reason}"</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingStatusChange(null)}
                                className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
                                data-testid="crm-status-confirm-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmStatusChange}
                                disabled={statusUpdating}
                                className="px-3 py-2 text-sm rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                                data-testid="crm-status-confirm-yes"
                            >
                                {statusUpdating ? 'Updating...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default CRMConsole;
