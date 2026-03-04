import React from 'react';
import { GitBranch, Trash2, Edit3, Plus, Zap } from 'lucide-react';
import { useTimeDisplay } from '../../hooks/useTimeDisplay';

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
const WorkflowList = ({ workflows = [], selectedId, onSelect, onDelete, onCreateNew }) => {
    const { formatTime } = useTimeDisplay();
    const [deleteConfirmId, setDeleteConfirmId] = React.useState(null);

    const handleDeleteClick = (e, workflowId) => {
        e.stopPropagation();
        setDeleteConfirmId(workflowId);
    };

    const handleConfirmDelete = (e) => {
        e.stopPropagation();
        if (deleteConfirmId) {
            onDelete(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    const handleCancelDelete = (e) => {
        e.stopPropagation();
        setDeleteConfirmId(null);
    };

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
                        {/* Delete Confirmation Overlay */}
                        {deleteConfirmId === wf.workflow_id && (
                            <div className="absolute inset-0 bg-white/95 rounded-xl flex items-center justify-center z-10 border border-red-200">
                                <div className="text-center p-3">
                                    <p className="text-sm font-medium text-gray-700 mb-3">Delete "{wf.workflow_id}"?</p>
                                    <div className="flex space-x-2 justify-center">
                                        <button
                                            onClick={handleCancelDelete}
                                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmDelete}
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                    {wf.created_at && (
                                        <span className="text-xs text-gray-300">
                                            {formatTime(wf.created_at).date}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSelect(wf); }}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => handleDeleteClick(e, wf.workflow_id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Button */}
            <div className="p-3 border-t border-gray-100">
                <button
                    onClick={onCreateNew}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Workflow</span>
                </button>
            </div>
        </div>
    );
};

export default WorkflowList;
