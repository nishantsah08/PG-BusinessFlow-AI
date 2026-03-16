import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Archive,
    Filter,
    MessageSquareText,
    Plus,
    Search,
    SendHorizontal,
    X,
} from 'lucide-react';
import apiClient from '../api/client';
import { useUI } from '../context/UIContext';

const FILTERS = ['Active', 'Draft', 'Archived', 'All'];

function cn(...parts) {
    return parts.filter(Boolean).join(' ');
}

function formatUpdatedLabel(value) {
    if (!value) return 'Updated recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Updated recently';
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function getSectionContent(workflow, key) {
    const section = workflow?.sop_document?.sections?.find((item) => item.key === key);
    return String(section?.content || '').trim();
}

function getWorkflowSummary(workflow) {
    return String(workflow?.description || getSectionContent(workflow, 'business_outcome') || 'No business outcome defined yet.').trim();
}

function buildSearchText(workflow) {
    const sectionText = Array.isArray(workflow?.sop_document?.sections)
        ? workflow.sop_document.sections.map((section) => `${section.title} ${section.content || ''}`).join(' ')
        : '';
    return `${workflow?.name || ''} ${getWorkflowSummary(workflow)} ${sectionText}`.toLowerCase();
}

const STATUS_STYLES = {
    Active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Draft: 'border-amber-200 bg-amber-50 text-amber-900',
    Archived: 'border-slate-300 bg-slate-100 text-slate-700',
};

const VALIDATION_STYLES = {
    validated: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    needs_correction: 'border-rose-300 bg-rose-50 text-rose-800',
    draft: 'border-slate-300 bg-white text-slate-700',
};

function StatusChip({ status }) {
    return (
        <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]', STATUS_STYLES[status] || STATUS_STYLES.Draft)}>
            {status}
        </span>
    );
}

function ValidationButton({ state, disabled, onClick, busy }) {
    return (
        <button
            type="button"
            disabled={disabled || busy}
            onClick={onClick}
            className={cn(
                'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                disabled || busy
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : VALIDATION_STYLES[state] || VALIDATION_STYLES.draft
            )}
        >
            {busy ? 'Validating...' : 'Validate'}
        </button>
    );
}

function WorkflowDocument({ workflow, resultMessage }) {
    const sections = Array.isArray(workflow?.sop_document?.sections) ? workflow.sop_document.sections : [];
    const showEmptyDocument = workflow?.version_type === 'tenant_draft'
        && !workflow?.description
        && sections.every((section) => !String(section.content || '').trim());

    return (
        <div className="h-full overflow-y-auto bg-white px-8 py-8 md:px-10">
            <div className="mx-auto max-w-4xl">
                <StatusChip status={workflow.business_state || 'Draft'} />
                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{workflow.name || 'Untitled SOP Draft'}</h2>
                {workflow.description ? (
                    <p className="mt-3 text-base leading-8 text-slate-600">{workflow.description}</p>
                ) : null}

                {resultMessage ? (
                    <section className="mt-10">
                        <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current Result</h3>
                        <div className="mt-3 whitespace-pre-line text-[15px] leading-8 text-slate-700">{resultMessage}</div>
                    </section>
                ) : null}

                {showEmptyDocument ? (
                    <div className="mt-12 text-[15px] leading-8 text-slate-400">
                        Start with the assistant on the right to prepare this SOP.
                    </div>
                ) : (
                    <div className="mt-10 space-y-10">
                        {sections
                            .filter((section) => String(section.content || '').trim())
                            .map((section) => (
                                <section key={section.key}>
                                    <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-indigo-700">{section.title}</h3>
                                    <div className="mt-3 whitespace-pre-line text-[15px] leading-8 text-slate-700">
                                        {section.content}
                                    </div>
                                </section>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function WorkflowStudioPage() {
    const { addNotification } = useUI();
    const [filter, setFilter] = useState('Active');
    const [query, setQuery] = useState('');
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createModalMode, setCreateModalMode] = useState('menu');
    const [existingQuery, setExistingQuery] = useState('');
    const [actionBusy, setActionBusy] = useState(null);

    const fetchWorkflows = async (preferredWorkflowId = null) => {
        setLoading(true);
        setLoadError(null);
        const response = await apiClient.get('/api/workflows');
        if (!response.success) {
            setLoadError(response.error || 'Failed to load SOPs.');
            setLoading(false);
            return null;
        }

        const rows = Array.isArray(response.data?.workflows) ? response.data.workflows : [];
        setWorkflows(rows);
        setLoading(false);

        if (preferredWorkflowId) {
            const preferred = rows.find((workflow) => workflow.workflow_id === preferredWorkflowId);
            return preferred || null;
        }
        return rows;
    };

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const attentionCount = useMemo(() => (
        workflows.filter((workflow) => (
            workflow.business_state === 'Draft'
            && ['validated', 'needs_correction'].includes(workflow.validation_status)
        )).length
    ), [workflows]);

    const filteredWorkflows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return workflows.filter((workflow) => {
            const matchesFilter = filter === 'All' || workflow.business_state === filter;
            const matchesQuery = !needle || buildSearchText(workflow).includes(needle);
            return matchesFilter && matchesQuery;
        });
    }, [filter, query, workflows]);

    const openWorkflow = (workflow) => {
        setWorkspace({
            workflow,
            messages: [],
            pendingProposal: null,
            resultMessage: workflow.validation_status === 'validated'
                ? 'Validated. Ready to publish.'
                : workflow.validation_status === 'needs_correction'
                    ? 'Validation failed. Needs correction.'
                    : workflow.version_type === 'tenant_draft'
                        ? 'Draft open. Ask for a change or validate it.'
                        : workflow.business_state === 'Archived'
                            ? 'Archived snapshot. Ask for a change and the system will prepare a draft.'
                            : 'Active SOP. Ask for a change and the system will prepare a draft in the background.',
        });
        setChatInput('');
        setPublishConfirmOpen(false);
    };

    const openWorkspaceForDraft = (draft, resultMessage = '') => {
        setWorkspace({
            workflow: draft,
            messages: [],
            pendingProposal: null,
            resultMessage,
        });
        setChatInput('');
        setPublishConfirmOpen(false);
    };

    const openBrandNewSop = async () => {
        setActionBusy('new');
        const response = await apiClient.post('/api/workflows', {
            workflow_family: `sop_${Date.now()}`,
            name: '',
            title: '',
        });
        setActionBusy(null);

        if (!response.success) {
            addNotification(response.error || 'Could not start a new SOP draft.', 'error');
            return;
        }

        const draft = response.data;
        setWorkflows((current) => [draft, ...current]);
        openWorkspaceForDraft(draft, '');
        setFilter('Draft');
        setCreateModalOpen(false);
        setCreateModalMode('menu');
        setExistingQuery('');
    };

    const ensureDraft = async (workflow) => {
        if (workflow.version_type === 'tenant_draft') {
            return workflow;
        }

        const response = await apiClient.post('/api/workflows', {
            clone_from_workflow_id: workflow.workflow_id,
        });
        if (!response.success) {
            throw new Error(response.error || 'Could not open a draft for this SOP.');
        }

        const draft = response.data;
        await fetchWorkflows(draft.workflow_id);
        return draft;
    };

    const openExistingSopDraft = async (workflow) => {
        setActionBusy('clone');
        try {
            const draft = await ensureDraft(workflow);
            openWorkspaceForDraft(draft, workflow.tenant_id
                ? 'Draft opened from the selected SOP.'
                : 'Custom draft created from the default SOP.');
            addNotification(workflow.tenant_id ? 'Draft opened.' : 'Custom draft created.', 'success');
            setFilter('Draft');
            setCreateModalOpen(false);
            setCreateModalMode('menu');
            setExistingQuery('');
        } catch (error) {
            addNotification(error.message, 'error');
        } finally {
            setActionBusy(null);
        }
    };

    const updateWorkspaceWorkflow = (workflow, message = null) => {
        setWorkspace((current) => (
            current
                ? {
                    ...current,
                    workflow,
                    pendingProposal: null,
                    resultMessage: message ?? current.resultMessage,
                }
                : current
        ));
    };

    const handleSaveDraft = async () => {
        if (!workspace) return;
        setActionBusy('save');
        try {
            const draft = await ensureDraft(workspace.workflow);
            updateWorkspaceWorkflow(draft, 'Draft saved.');
            addNotification('Draft saved.', 'success');
        } catch (error) {
            addNotification(error.message, 'error');
        } finally {
            setActionBusy(null);
        }
    };

    const handleStartDraftFromWorkspace = async () => {
        if (!workspace) return;
        await openExistingSopDraft(workspace.workflow);
    };

    const handleChatSubmit = async (event) => {
        event.preventDefault();
        if (!workspace) return;

        const message = chatInput.trim();
        if (!message) return;

        const currentWorkflow = workspace.workflow;
        setWorkspace((current) => (
            current
                ? {
                    ...current,
                    messages: [...current.messages, { role: 'user', content: message }],
                }
                : current
        ));
        setChatInput('');
        setActionBusy('chat');

        const response = await apiClient.post(`/api/workflows/${currentWorkflow.workflow_id}/chat`, { message });
        setActionBusy(null);

        if (!response.success) {
            addNotification(response.error || 'Could not get SOP assistance.', 'error');
            setWorkspace((current) => (
                current
                    ? {
                        ...current,
                        messages: [...current.messages, { role: 'assistant', content: response.error || 'Could not get SOP assistance.' }],
                    }
                    : current
            ));
            return;
        }

        setWorkspace((current) => (
            current
                ? {
                    ...current,
                    messages: [...current.messages, { role: 'assistant', content: response.data?.reply || 'No reply received.' }],
                    pendingProposal: response.data?.proposal || null,
                }
                : current
        ));
    };

    const handleDiscardProposal = () => {
        setWorkspace((current) => (
            current
                ? {
                    ...current,
                    pendingProposal: null,
                    messages: [...current.messages, { role: 'assistant', content: 'Proposal discarded. The SOP document has not changed.' }],
                }
                : current
        ));
    };

    const handleApplyProposal = async () => {
        if (!workspace?.pendingProposal) return;
        setActionBusy('apply');

        try {
            const draft = await ensureDraft(workspace.workflow);
            const response = await apiClient.put(`/api/workflows/${draft.workflow_id}`, workspace.pendingProposal.patch || {});
            if (!response.success) {
                throw new Error(response.error || 'Could not apply the SOP change.');
            }

            const updatedDraft = response.data;
            await fetchWorkflows(updatedDraft.workflow_id);
            setWorkspace((current) => (
                current
                    ? {
                        ...current,
                        workflow: updatedDraft,
                        pendingProposal: null,
                        resultMessage: 'Draft updated. Not validated yet.',
                        messages: [...current.messages, { role: 'assistant', content: 'Change applied. The SOP document now shows the updated draft.' }],
                    }
                    : current
            ));
            addNotification('SOP change applied to draft.', 'success');
        } catch (error) {
            addNotification(error.message, 'error');
        } finally {
            setActionBusy(null);
        }
    };

    const handleValidate = async () => {
        if (!workspace) return;
        if (workspace.workflow.version_type !== 'tenant_draft') {
            addNotification('Open or create a draft before validation.', 'info');
            return;
        }

        setActionBusy('validate');
        const response = await apiClient.post(`/api/workflows/${workspace.workflow.workflow_id}/validate`, {});
        setActionBusy(null);

        if (!response.success) {
            addNotification(response.error || 'Validation failed.', 'error');
            return;
        }

        const validation = response.data?.validation || {};
        const workflow = response.data?.workflow || workspace.workflow;
        await fetchWorkflows(workflow.workflow_id);
        updateWorkspaceWorkflow(workflow, validation.ok ? 'Validated. Ready to publish.' : 'Validation failed. Needs correction.');
        setWorkspace((current) => (
            current
                ? {
                    ...current,
                    workflow,
                    resultMessage: validation.ok ? 'Validated. Ready to publish.' : 'Validation failed. Needs correction.',
                    messages: [...current.messages, { role: 'assistant', content: validation.ok ? 'Validation passed. This draft is ready to publish.' : (validation.errors?.[0] || 'Validation failed. Please correct the SOP.') }],
                }
                : current
        ));
    };

    const handleConfirmPublish = async () => {
        if (!workspace) return;
        setActionBusy('publish');
        const response = await apiClient.post(`/api/workflows/${workspace.workflow.workflow_id}/publish`, {});
        setActionBusy(null);

        if (!response.success) {
            addNotification(response.error || 'Could not publish this SOP.', 'error');
            return;
        }

        await fetchWorkflows();
        addNotification(`${response.data?.name || workspace.workflow.name || 'SOP'} is now live.`, 'success');
        setPublishConfirmOpen(false);
        setWorkspace(null);
        setFilter('Active');
    };

    const handleArchive = async () => {
        if (!workspace?.workflow?.tenant_id || workspace.workflow.version_type !== 'tenant_published') {
            return;
        }
        setActionBusy('archive');
        const response = await apiClient.post(`/api/workflows/${workspace.workflow.workflow_id}/archive`, {});
        setActionBusy(null);

        if (!response.success) {
            addNotification(response.error || 'Could not archive this SOP.', 'error');
            return;
        }

        await fetchWorkflows();
        addNotification(`${workspace.workflow.name} archived.`, 'success');
        setWorkspace(null);
        setFilter('Archived');
    };

    const cloneSourceRows = useMemo(() => {
        const needle = existingQuery.trim().toLowerCase();
        return workflows
            .filter((workflow) => workflow.version_type !== 'tenant_draft')
            .filter((workflow) => !needle || buildSearchText(workflow).includes(needle));
    }, [existingQuery, workflows]);

    const workspaceDraftActionLabel = useMemo(() => {
        if (!workspace?.workflow) return 'Create Draft';
        if (!workspace.workflow.tenant_id) return 'Create Custom Draft';
        return 'Create Draft';
    }, [workspace]);

    const workspaceOverlay = workspace ? createPortal(
        <div className="fixed inset-0 z-[200] bg-[#f7f4eb]" data-testid="workflow-workspace">
            <div className="flex h-full flex-col">
                <div className="border-b border-slate-200 bg-white px-6 py-4 md:px-8">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                            <StatusChip status={workspace.workflow.business_state || 'Draft'} />
                            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                                {workspace.workflow.name || 'Untitled SOP Draft'}
                            </h1>
                            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                                {getWorkflowSummary(workspace.workflow)}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3">
                            {workspace.workflow.version_type === 'tenant_draft' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleSaveDraft}
                                        disabled={actionBusy !== null}
                                        className={cn(
                                            'rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700',
                                            actionBusy !== null && 'cursor-not-allowed opacity-60'
                                        )}
                                    >
                                        {actionBusy === 'save' || actionBusy === 'new' ? 'Saving...' : 'Save Draft'}
                                    </button>
                                    <ValidationButton
                                        state={workspace.workflow.validation_status || 'draft'}
                                        disabled={false}
                                        busy={actionBusy === 'validate'}
                                        onClick={handleValidate}
                                    />
                                    <button
                                        type="button"
                                        disabled={workspace.workflow.validation_status !== 'validated' || actionBusy !== null}
                                        onClick={() => setPublishConfirmOpen(true)}
                                        className={cn(
                                            'rounded-full px-4 py-2 text-sm font-semibold',
                                            workspace.workflow.validation_status === 'validated' && actionBusy === null
                                                ? 'bg-emerald-600 text-white'
                                                : 'cursor-not-allowed bg-slate-200 text-slate-400'
                                        )}
                                    >
                                        {actionBusy === 'publish' ? 'Publishing...' : 'Publish'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleStartDraftFromWorkspace}
                                    disabled={actionBusy !== null}
                                    className={cn(
                                        'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white',
                                        actionBusy !== null && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    {actionBusy === 'clone' ? 'Opening Draft...' : workspaceDraftActionLabel}
                                </button>
                            )}
                            {workspace.workflow.tenant_id && workspace.workflow.version_type === 'tenant_published' ? (
                                <button
                                    type="button"
                                    onClick={handleArchive}
                                    disabled={actionBusy !== null}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                                >
                                    <Archive className="h-4 w-4" />
                                    Archive
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    setWorkspace(null);
                                    setChatInput('');
                                    setPublishConfirmOpen(false);
                                }}
                                className="rounded-full border border-slate-300 p-2 text-slate-700"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 xl:grid-cols-[1.22fr_0.78fr]">
                    <WorkflowDocument workflow={workspace.workflow} resultMessage={workspace.resultMessage} />

                    <div className="flex min-h-0 flex-col border-l border-slate-200 bg-[#fbfaf7]">
                        <div className="border-b border-slate-200 bg-white px-6 py-4">
                            <div className="text-sm font-semibold text-slate-900">SOP Assistant</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                                Same business context as MasterAI, but focused only on this SOP.
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                            {workspace.messages.length === 0 ? (
                                <div className="text-sm leading-7 text-slate-400" data-testid="sop-chat-empty">
                                    {workspace.workflow.version_type === 'tenant_draft' && !workspace.workflow.description
                                        ? ''
                                        : 'Ask for a change, clarification, or explanation for this SOP.'}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {workspace.messages.map((message, index) => (
                                        <div
                                            key={`${message.role}-${index}`}
                                            data-testid={`sop-chat-message-${message.role}`}
                                            className={cn(
                                                'rounded-[20px] px-4 py-3 text-sm leading-7',
                                                message.role === 'assistant'
                                                    ? 'bg-slate-100 text-slate-800'
                                                    : 'bg-amber-50 text-amber-900'
                                            )}
                                        >
                                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                {message.role === 'assistant' ? 'Assistant' : 'You'}
                                            </div>
                                            <div className="whitespace-pre-line">{message.content}</div>
                                        </div>
                                    ))}

                                    {workspace.pendingProposal ? (
                                        <div className="rounded-[20px] border border-sky-200 bg-sky-50 p-4" data-testid="sop-chat-proposal">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Proposed Change</div>
                                            <div className="mt-3 text-sm leading-7 text-sky-900">{workspace.pendingProposal.preview}</div>
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleApplyProposal}
                                                    disabled={actionBusy !== null}
                                                    className={cn(
                                                        'rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white',
                                                        actionBusy !== null && 'cursor-not-allowed opacity-60'
                                                    )}
                                                >
                                                    {actionBusy === 'apply' ? 'Applying...' : 'Apply Change'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleDiscardProposal}
                                                    disabled={actionBusy !== null}
                                                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                                                >
                                                    Discard
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200 bg-white px-6 py-4">
                            <form onSubmit={handleChatSubmit} className="flex items-end gap-3">
                                <div className="flex min-h-[56px] flex-1 items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                                    <MessageSquareText className="h-4 w-4 text-slate-400" />
                                    <input
                                        value={chatInput}
                                        onChange={(event) => setChatInput(event.target.value)}
                                        placeholder="Ask about this SOP..."
                                        className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={actionBusy === 'chat'}
                                    className="inline-flex h-[56px] items-center justify-center rounded-[18px] bg-slate-900 px-5 text-white"
                                    aria-label="Send"
                                >
                                    <SendHorizontal className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    const publishOverlay = publishConfirmOpen && workspace ? createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/55 p-4">
            <div className="w-full max-w-[520px] rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
                <div className="text-2xl font-semibold tracking-tight text-slate-900">Publish {workspace.workflow.name || 'this SOP'}?</div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                    This validated draft will become the live SOP. The current live tenant version, if one exists, will move to archived history.
                </p>
                <div className="mt-6 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                    <div>{workspace.workflow.name || 'Untitled SOP Draft'}</div>
                    <div className="text-slate-500">Validation status: {workspace.workflow.validation_status || 'draft'}</div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setPublishConfirmOpen(false)}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmPublish}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Publish Now
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="min-h-full bg-[#f7f4eb] px-6 py-8 md:px-8">
            <div className="w-full">
                <div className="flex flex-col gap-6 rounded-[32px] border border-slate-200 bg-[#f9f6ee] p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">SOPs</div>
                            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">SOPs</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                                Active, draft, and archived business procedures. Changes happen through the SOP assistant and the system handles versioning in the background.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
                                {attentionCount} drafts need review
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCreateModalOpen(true);
                                    setCreateModalMode('menu');
                                    setExistingQuery('');
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                            >
                                <Plus className="h-4 w-4" />
                                New SOP
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 lg:max-w-[340px]">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search SOPs..."
                                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {FILTERS.map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setFilter(value)}
                                        className={cn(
                                            'rounded-full border px-4 py-2 text-sm font-semibold',
                                            filter === value
                                                ? 'border-slate-950 bg-slate-950 text-white'
                                                : 'border-slate-200 bg-white text-slate-700'
                                        )}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                            <Filter className="h-4 w-4" />
                            Filter: {filter}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                        <div className="grid grid-cols-[140px_1.55fr_2.05fr_180px_220px] border-b border-slate-200 px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <div>State</div>
                            <div>SOP</div>
                            <div>What It Does</div>
                            <div>Updated</div>
                            <div className="text-right">Action</div>
                        </div>

                        {loading ? (
                            <div className="px-6 py-10 text-sm text-slate-500">Loading SOPs...</div>
                        ) : loadError ? (
                            <div className="px-6 py-10 text-sm text-rose-700">{loadError}</div>
                        ) : filteredWorkflows.length === 0 ? (
                            <div className="px-6 py-10 text-sm text-slate-500">No SOPs match this view.</div>
                        ) : (
                            filteredWorkflows.map((workflow) => (
                                <div
                                    key={workflow.workflow_id}
                                    className="grid grid-cols-[140px_1.55fr_2.05fr_180px_220px] items-start border-b border-slate-200 px-4 py-5 last:border-b-0"
                                >
                                    <div>
                                        <StatusChip status={workflow.business_state || 'Draft'} />
                                    </div>
                                    <div className="pr-6">
                                        <div className="text-2xl font-semibold tracking-tight text-slate-900">{workflow.name}</div>
                                    </div>
                                    <div className="pr-6 text-sm leading-7 text-slate-600">
                                        <div>{getWorkflowSummary(workflow)}</div>
                                        {workflow.tenant_state ? (
                                            <div className="mt-1 text-xs text-slate-400">{workflow.tenant_state.replace(/_/g, ' ').toLowerCase()}</div>
                                        ) : null}
                                    </div>
                                    <div className="text-sm text-slate-500">{formatUpdatedLabel(workflow.updated_at || workflow.created_at)}</div>
                                    <div className="flex justify-end gap-2">
                                        {workflow.version_type !== 'tenant_draft' ? (
                                            <button
                                                type="button"
                                                onClick={() => openExistingSopDraft(workflow)}
                                                disabled={actionBusy !== null}
                                                className={cn(
                                                    'rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700',
                                                    actionBusy !== null && 'cursor-not-allowed opacity-60'
                                                )}
                                            >
                                                {!workflow.tenant_id ? 'Create Custom Draft' : 'Create Draft'}
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => openWorkflow(workflow)}
                                            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                                        >
                                            Open
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {workspaceOverlay}
            {publishOverlay}
            {createModalOpen ? createPortal(
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/55 p-4">
                    <div className="w-full max-w-[760px] rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-2xl font-semibold tracking-tight text-slate-900">Create SOP</div>
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                    Start from a blank SOP or prepare a draft based on an existing SOP.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCreateModalOpen(false);
                                    setCreateModalMode('menu');
                                    setExistingQuery('');
                                }}
                                className="rounded-full border border-slate-300 p-2 text-slate-700"
                                aria-label="Close Create SOP"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {createModalMode === 'menu' ? (
                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={openBrandNewSop}
                                    disabled={actionBusy !== null}
                                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-slate-300 hover:bg-slate-100"
                                >
                                    <div className="text-lg font-semibold text-slate-900">Brand New SOP</div>
                                    <div className="mt-2 text-sm leading-7 text-slate-600">
                                        Start with a blank SOP document and a blank chat window.
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreateModalMode('existing')}
                                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-slate-300 hover:bg-slate-100"
                                >
                                    <div className="text-lg font-semibold text-slate-900">Based on Existing SOP</div>
                                    <div className="mt-2 text-sm leading-7 text-slate-600">
                                        Pick an existing SOP and create a draft from it in the background.
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <div className="mt-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setCreateModalMode('menu')}
                                        className="w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                                    >
                                        Back
                                    </button>
                                    <div className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 md:max-w-[340px]">
                                        <Search className="h-4 w-4 text-slate-400" />
                                        <input
                                            value={existingQuery}
                                            onChange={(event) => setExistingQuery(event.target.value)}
                                            placeholder="Search existing SOPs..."
                                            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 max-h-[420px] overflow-y-auto rounded-[24px] border border-slate-200">
                                    {cloneSourceRows.length === 0 ? (
                                        <div className="px-5 py-8 text-sm text-slate-500">No SOPs available for this view.</div>
                                    ) : (
                                        cloneSourceRows.map((workflow) => (
                                            <div
                                                key={`clone-${workflow.workflow_id}`}
                                                className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="text-lg font-semibold text-slate-900">{workflow.name}</div>
                                                        <StatusChip status={workflow.business_state || 'Draft'} />
                                                    </div>
                                                    <div className="mt-2 text-sm leading-7 text-slate-600">{getWorkflowSummary(workflow)}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => openExistingSopDraft(workflow)}
                                                    disabled={actionBusy !== null}
                                                    className={cn(
                                                        'shrink-0 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white',
                                                        actionBusy !== null && 'cursor-not-allowed opacity-60'
                                                    )}
                                                >
                                                    Use This SOP
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            ) : null}
        </div>
    );
}

export default WorkflowStudioPage;
