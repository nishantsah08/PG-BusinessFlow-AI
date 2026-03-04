import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import WorkflowList from '../workflows/WorkflowList';
import WorkflowBuilder from '../workflows/WorkflowBuilder';
import { useUI } from '../../context/UIContext';

/**
 * WorkflowsView
 * Acts as the container for the Workflow definitions tab inside the Master AI Control Panel.
 * Uses a Master-Detail stacking pattern (List view OR Builder view) since panel width is constrained.
 */
const WorkflowsView = () => {
    const { addNotification } = useUI();

    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'build'
    const [loadState, setLoadState] = useState('loading');
    const [loadError, setLoadError] = useState(null);

    // Fetch workflows
    const fetchWorkflows = useCallback(async () => {
        setLoadState('loading');
        setLoadError(null);
        const result = await apiClient.get('/api/workflows');
        if (result.success) {
            const data = result.data?.workflows || [];
            setWorkflows(data);
            setLoadState(data.length > 0 ? 'success' : 'empty');
        } else {
            setLoadError(result.error || 'Failed to load workflows');
            setLoadState('error');
        }
    }, []);

    useEffect(() => {
        fetchWorkflows();

        // Fast-polling or event-driven update could go here. 
        // For now, refreshing every 3 seconds while in list view so if MasterAI creates one, it pops up!
        const intervalId = setInterval(() => {
            if (viewMode === 'list') {
                apiClient.get('/api/workflows').then(result => {
                    if (result.success) {
                        const data = result.data?.workflows || [];
                        setWorkflows(data);
                        setLoadState(data.length > 0 ? 'success' : 'empty');
                    }
                });
            }
        }, 3000);
        return () => clearInterval(intervalId);
    }, [fetchWorkflows, viewMode]);

    // Create New
    const handleCreateNew = () => {
        setSelectedWorkflow(null);
        setViewMode('build');
    };

    // Select for viewing/editing
    const handleSelect = (wf) => {
        setSelectedWorkflow(wf);
        setViewMode('build');
    };

    // Save (create or update)
    const handleSave = async (data) => {
        const isEdit = !!selectedWorkflow;
        let result;
        if (isEdit) {
            result = await apiClient.put(`/api/workflows/${data.workflow_id}`, data);
        } else {
            result = await apiClient.post('/api/workflows', data);
        }

        if (result.success) {
            addNotification(
                isEdit ? `Workflow "${data.workflow_id}" updated.` : `Workflow "${data.workflow_id}" created.`,
                'success'
            );
            setViewMode('list');
            setSelectedWorkflow(null);
            fetchWorkflows();
        } else {
            addNotification(result.error || 'Save failed', 'error');
        }
    };

    // Delete
    const handleDelete = async (workflowId) => {
        const result = await apiClient.delete(`/api/workflows/${workflowId}`);
        if (result.success) {
            addNotification(`Workflow "${workflowId}" deleted.`, 'success');
            if (selectedWorkflow?.workflow_id === workflowId) {
                setSelectedWorkflow(null);
                setViewMode('list');
            }
            fetchWorkflows();
        } else {
            addNotification(result.error || 'Delete failed', 'error');
        }
    };

    // Cancel builder
    const handleCancel = () => {
        setSelectedWorkflow(null);
        setViewMode('list');
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white">
            {viewMode === 'list' ? (
                <div className="flex-1 overflow-hidden relative">
                    <StateWrapper
                        state={loadState}
                        error={loadError}
                        onRetry={fetchWorkflows}
                        emptyMessage="No workflows. Ask MasterAI to define a process, or build one manually."
                    >
                        <WorkflowList
                            workflows={workflows}
                            selectedId={selectedWorkflow?.workflow_id}
                            onSelect={handleSelect}
                            onDelete={handleDelete}
                            onCreateNew={handleCreateNew}
                        />
                    </StateWrapper>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden relative">
                    <WorkflowBuilder
                        workflow={selectedWorkflow}
                        onSave={handleSave}
                        onCancel={handleCancel}
                    />
                </div>
            )}
        </div>
    );
};

export default WorkflowsView;
