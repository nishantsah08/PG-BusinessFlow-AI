import React, { useState } from 'react';
import { Power, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
import apiClient from '../../api/client';
import { useUI } from '../../context/UIContext';

/**
 * Renders an individual Agent card and handles its local optimistic control state.
 * Never stores its state globally.
 */
const AgentCard = ({ agent, onActionSuccess }) => {
    const { addNotification } = useUI();
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionState, setActionState] = useState(null); // 'processing', 'success', 'failed'

    const handleAction = async (actionStr) => {
        setIsProcessing(true);
        setActionState('processing');

        const response = await apiClient.post('/api/system/agent/control', {
            agent_name: agent.name,
            action: actionStr
        });

        setIsProcessing(false);

        if (!response.success) {
            setActionState('failed');
            addNotification(
                `Failed to ${actionStr} ${agent.name}: ${response.error || 'Unknown error'}`,
                'error',
                5000
            );

            // Clear badge after 3 seconds
            setTimeout(() => setActionState(null), 3000);
            return;
        }

        setActionState('success');

        // Notify parent to refresh real state
        if (onActionSuccess) {
            onActionSuccess();
        }

        // Clear badge after 3 seconds
        setTimeout(() => setActionState(null), 3000);
    };

    const isOnline = agent.status === 'online';
    const isQuarantined = agent.status === 'quarantined';

    return (
        <div
            data-testid={`card-${agent.name}`}
            data-state={isOnline ? 'online' : 'offline'}
            data-processing={isProcessing}
            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-4 flex flex-col justify-between h-full"
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        {agent.name}
                        {isQuarantined && <ShieldAlert className="w-4 h-4 ml-2 text-orange-500" title="Quarantined" />}
                    </h3>
                    <div className="flex items-center mt-1">
                        <span className={`h-2 w-2 rounded-full mr-2 ${isOnline ? 'bg-green-500' : isQuarantined ? 'bg-orange-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-gray-600 capitalize">{isOnline ? 'Online' : agent.status}</span>
                    </div>
                </div>

                <div className="flex flex-col items-end space-y-2">
                    {actionState && (
                        <div className="flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border">
                            {actionState === 'processing' && <span className="text-gray-600 bg-gray-100 border-gray-200"><span className="animate-pulse">Processing...</span></span>}
                            {actionState === 'success' && <span className="text-green-700 bg-green-50 border-green-200">Success</span>}
                            {actionState === 'failed' && <span className="text-red-700 bg-red-50 border-red-200">Failed</span>}
                        </div>
                    )}
                    <div className="flex space-x-2">
                        {/* Toggle Button */}
                        <button
                            data-testid={`toggle-${agent.name}`}
                            onClick={() => handleAction(isOnline ? 'disable' : 'enable')}
                            disabled={isProcessing || isQuarantined}
                            className={`p-2 rounded-md border transition-colors ${isOnline
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-50'
                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 disabled:opacity-50'
                                }`}
                            title={isOnline ? 'Disable Agent' : 'Enable Agent'}
                        >
                            {isProcessing ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Power className="w-4 h-4" />
                            )}
                        </button>

                        {/* Restart Button */}
                        <button
                            data-testid={`restart-${agent.name}`}
                            onClick={() => handleAction('restart')}
                            disabled={isProcessing}
                            className="p-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
                            title="Restart Agent"
                        >
                            <RotateCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-gray-50 pb-2">
                    <span className="text-gray-500">Last Heartbeat</span>
                    <span className="font-mono text-gray-700">{agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleTimeString() : 'N/A'}</span>
                </div>

                <div className="flex justify-between border-b border-gray-50 pb-2">
                    <span className="text-gray-500">Latency</span>
                    <span className="font-mono text-gray-700">{agent.latency_ms !== undefined ? `${agent.latency_ms}ms` : 'N/A'}</span>
                </div>

                {agent.last_error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-red-800 text-xs flex items-start border border-red-100">
                        <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{agent.last_error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentCard;
