import React from 'react';
import { GitBranch, Zap, Power, PowerOff } from 'lucide-react';
import { useTimeDisplay } from '../../hooks/useTimeDisplay';

const getWorkflowTypeLabel = (workflow) => {
    if (workflow?.tenant_id && !workflow?.protected) {
        return workflow?.clone_of_workflow_id ? 'User Cloned' : 'User Custom';
    }
    if (workflow?.protected) return 'System Default';
    return 'User Custom';
};

const getWorkflowStateLabel = (workflow) => {
    if (workflow?.tenant_id && !workflow?.protected) {
        return workflow?.is_active ? 'Enabled' : 'Disabled';
    }
    if (workflow?.template_state === 'OVERRIDDEN_BY_TENANT') {
        return 'Disabled';
    }
    return 'Enabled';
};

const getWorkflowStateClasses = (workflow) => {
    const label = getWorkflowStateLabel(workflow);
    return label === 'Enabled'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-600';
};

/**
 * WorkflowList Component
 * Renders a scrollable list of workflow definition cards.
 * Each card shows workflow_id, trigger_event, step count, and action buttons.
 *
 * Props:
 * - workflows: Array of workflow definition objects
 * - selectedId: Currently selected workflow_id (string | null)
 * - onSelect: (workflow) => void — called when a card is clicked for editing
 * - onDelete: (workflow_id) => void — called when delete is confirmed
 * - onCreateNew: () => void — called when "+ New Workflow" is clicked
 */
const WorkflowList = ({
    workflows = [],
    selectedId,
    onSelect,
    onActivate,
    onDeactivate,
    canManage = false,
}) => {
    const { formatTime } = useTimeDisplay();

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                    <GitBranch className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-gray-800">Workflow Definitions</h2>
                </div>
                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    {workflows.length}
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {workflows.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <GitBranch className="w-10 h-10 mb-3 text-gray-300" />
                        <p className="text-sm font-medium">No workflows defined yet.</p>
                        <p className="text-xs mt-1">Create your first business process workflow.</p>
                    </div>
                )}

                {workflows.map((wf) => (
                    <div
                        key={wf.workflow_id}
                        onClick={() => onSelect(wf)}
                        className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 group
                            ${selectedId === wf.workflow_id
                                ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="text-sm font-semibold text-gray-800 truncate mb-1">{wf.name || wf.workflow_id || 'Untitled Process'}</h3>
                                {wf.description ? (
                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{wf.description}</p>
                                ) : (
                                    <div className="flex items-center space-x-1.5 mt-0.5">
                                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-xs text-gray-500 truncate">{wf.trigger_event}</span>
                                    </div>
                                )}
                                <div className="flex items-center space-x-3 mt-2">
                                    <span className="text-xs text-gray-400">
                                        {wf.steps?.length || 0} step{(wf.steps?.length || 0) !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                        {getWorkflowTypeLabel(wf)}
                                    </span>
                                    <span className={`text-[10px] font-semibold uppercase tracking-[0.15em] px-2 py-1 rounded-full ${getWorkflowStateClasses(wf)}`}>
                                        {getWorkflowStateLabel(wf)}
                                    </span>
                                    {wf.created_at && (
                                        <span className="text-xs text-gray-300">
                                            {formatTime(wf.created_at).date}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                {canManage && wf.tenant_id && !wf.protected && (
                                    wf.is_active ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeactivate?.(wf.workflow_id); }}
                                            className="p-1.5 text-gray-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Deactivate"
                                        >
                                            <PowerOff className="w-3.5 h-3.5" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onActivate?.(wf.workflow_id); }}
                                            className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Activate"
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorkflowList;
