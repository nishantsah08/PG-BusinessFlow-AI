import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Bot, CheckCircle2, Clock3, Workflow } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value) => {
    if (!value) return 'Just now';
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

const OverviewPage = () => {
    const navigate = useNavigate();
    const { authContext } = useAuth();
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [events, setEvents] = useState([]);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const [approvalResponse, eventResponse] = await Promise.all([
                apiClient.get('/api/finance/approvals'),
                apiClient.get('/api/master_ai/events?limit=20'),
            ]);

            if (cancelled) return;

            setPendingApprovals(approvalResponse?.data?.pending || []);
            setEvents(Array.isArray(eventResponse?.data) ? eventResponse.data : []);
            setNotice(authContext?.profile_type === 'CEO'
                ? 'System-wide approvals and workflow activity land here first.'
                : 'You are seeing only the approvals and workflow activity within your allowed scope.');
        };

        load();
        return () => { cancelled = true; };
    }, [authContext?.profile_type]);

    const workflowEvents = useMemo(() => (
        events.filter((event) => {
            const eventType = String(event?.event_type || '');
            const sourceAgent = String(event?.payload?.agent || '');
            return eventType.startsWith('workflow.')
                || sourceAgent === 'FinanceAI'
                || sourceAgent === 'MasterAI';
        }).slice(0, 12)
    ), [events]);

    const pendingTitle = authContext?.profile_type === 'CEO'
        ? 'Pending approvals'
        : 'Your pending requests';

    return (
        <div className="h-full overflow-auto bg-slate-100">
            <div className="space-y-6 px-6 py-6">
                <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Overview</p>
                            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">System approvals and workflow watch</h1>
                            <p className="mt-3 max-w-3xl text-sm text-slate-600">{notice}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/master?context=finance')}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                <Bot className="h-4 w-4" />
                                Ask Finance AI
                            </button>
                            <Link
                                to="/finance"
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"
                            >
                                Open Finance
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="overview-approvals">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{pendingTitle}</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{pendingApprovals.length} open</h2>
                            </div>
                            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                                Finance approval queue
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {pendingApprovals.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    No finance approvals are waiting right now.
                                </div>
                            ) : pendingApprovals.map((request) => (
                                <div key={request.authorization_id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">{request.workflow_id}</div>
                                            <div className="mt-1 text-sm text-slate-600">
                                                Requested by {request.requested_by || 'Unknown'} · {request.requested_by_role || 'Unknown role'}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(request.created_at)}</div>
                                        </div>
                                        <Link
                                            to="/finance"
                                            className="inline-flex items-center gap-2 self-start rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                                        >
                                            Review in Finance
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="overview-workflow-activity">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow activity</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Recent system flow</h2>
                            </div>
                            <Link
                                to="/master"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                            >
                                Open System Observation
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        <div className="mt-5 space-y-3">
                            {workflowEvents.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    Workflow activity will appear here as approvals, executions, and exceptions happen.
                                </div>
                            ) : workflowEvents.map((event) => {
                                const eventType = String(event?.event_type || '');
                                const isFailure = /error|failed/i.test(eventType);
                                const Icon = isFailure ? AlertCircle : (eventType.endsWith('ended') || eventType.endsWith('executed') ? CheckCircle2 : (eventType.includes('requested') ? Clock3 : Workflow));
                                return (
                                    <div key={event.event_id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className={`mt-0.5 rounded-full p-2 ${isFailure ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-slate-900">{eventType}</div>
                                            <div className="mt-1 text-sm text-slate-600">
                                                {(event?.payload?.workflow_id || event?.payload?.tool || 'System event')}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(event.timestamp)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default OverviewPage;
