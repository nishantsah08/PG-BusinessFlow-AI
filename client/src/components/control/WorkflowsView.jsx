import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import WorkflowList from '../workflows/WorkflowList';
import WorkflowDefinitionViewer from '../workflows/WorkflowDefinitionViewer';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';

/**
 * WorkflowsView
 * Acts as the container for the Workflow definitions tab inside the Master AI Control Panel.
 * Uses a Master-Detail stacking pattern (List view OR Builder view) since panel width is constrained.
 */
const WorkflowsView = () => {
    const { addNotification } = useUI();
    const { authContext } = useAuth();

    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
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

        // Refresh while in list view so chat/whatsapp workflow changes appear automatically.
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

    // Select for viewing
    const handleSelect = (wf) => {
        setSelectedWorkflow(wf);
        setViewMode('detail');
    };

    const handleActivate = async (workflowId) => {
        const result = await apiClient.post(`/api/workflows/${workflowId}/activate`, {});
        if (result.success) {
            addNotification(`Workflow "${workflowId}" is now active for this tenant.`, 'success');
            fetchWorkflows();
            if (selectedWorkflow?.workflow_id === workflowId) {
                const refreshed = result.data || null;
                if (refreshed) setSelectedWorkflow(refreshed);
            }
        } else {
            addNotification(result.error || 'Activation failed', 'error');
        }
    };

    const handleDeactivate = async (workflowId) => {
        const result = await apiClient.post(`/api/workflows/${workflowId}/deactivate`, {});
        if (result.success) {
            addNotification(`Workflow "${workflowId}" is now inactive.`, 'success');
            fetchWorkflows();
            if (selectedWorkflow?.workflow_id === workflowId) {
                const refreshed = result.data || null;
                if (refreshed) setSelectedWorkflow(refreshed);
            }
        } else {
            addNotification(result.error || 'Deactivation failed', 'error');
        }
    };

    const handleBack = () => {
        setViewMode('list');
        setSelectedWorkflow(null);
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
                            onActivate={handleActivate}
                            onDeactivate={handleDeactivate}
                            canManage={authContext?.profile_type === 'CEO'}
                        />
                    </StateWrapper>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden relative">
                    <WorkflowDefinitionViewer
                        workflow={selectedWorkflow}
                        canManage={authContext?.profile_type === 'CEO'}
                        onBack={handleBack}
                        onActivate={handleActivate}
                        onDeactivate={handleDeactivate}
                    />
                </div>
            )}
        </div>
    );
};

export default WorkflowsView;
