import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import AgentCard from './AgentCard';
import useRealtimeSource from '../../hooks/useRealtimeSource';

/**
 * AgentDashboard Component
 * Orchestrates the list of all agents, their status, and delegating control UI.
 */
const AgentDashboard = () => {
    const [status, setStatus] = useState('loading');
    const [agents, setAgents] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);

    const fetchAgents = async () => {
        setStatus('loading');
        try {
            const response = await apiClient.get('/api/system/agents');

            if (response.success && response.data?.agents && Array.isArray(response.data.agents)) {
                if (response.data.agents.length > 0) {
                    setAgents(response.data.agents);
                    setStatus('success');
                } else {
                    setAgents([]);
                    setStatus('empty');
                }
            } else {
                throw new Error(response.error || 'Failed to parse agent list');
            }
        } catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    // Reactive subscription to replace polling
    useRealtimeSource('/api/system/events/stream', (event) => {
        // Refresh agents when system events occur to ensure dashboard is in sync
        // Ignore ping events
        if (event && event.event_type !== 'ping') {
            fetchAgents();
        }
    });

    return (
        <div className="h-full w-full bg-gray-50 flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Agent Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">System agent status and control</p>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                <StateWrapper
                    state={status}
                    error={errorMsg}
                    onRetry={fetchAgents}
                    emptyMessage="No agents currently registered in the system."
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {agents.map((agent) => (
                            <AgentCard
                                key={agent.name}
                                agent={agent}
                                onActionSuccess={fetchAgents} // Refresh all agents if an action succeeds
                            />
                        ))}
                    </div>
                </StateWrapper>
            </div>
        </div>
    );
};

export default AgentDashboard;
