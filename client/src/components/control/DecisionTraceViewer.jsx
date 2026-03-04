import React, { useState, useEffect } from 'react';
import { GitMerge, Code } from 'lucide-react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';

/**
 * DecisionTraceViewer
 * Displays MasterAI's internal reasoning/trace based on the active correlation ID.
 */
const DecisionTraceViewer = ({ traceId, onLogRequest }) => {
    const [status, setStatus] = useState('empty');
    const [traceData, setTraceData] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    const fetchTrace = async (id) => {
        if (!id) {
            setStatus('empty');
            return;
        }

        setStatus('loading');
        try {
            const response = await apiClient.get(`/api/master_ai/trace/${id}`);
            if (response.success && response.data) {
                setTraceData(response.data);
                setStatus('success');
            } else {
                // Determine if it's genuinely missing (empty) or failed
                if (response.error && response.error.includes('404')) {
                    setStatus('empty');
                } else {
                    throw new Error(response.error || 'Failed to load trace');
                }
            }
        } catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
        }
    };

    useEffect(() => {
        fetchTrace(traceId);
    }, [traceId]);

    return (
        <div className="h-full w-full">
            <StateWrapper
                state={status}
                error={errorMsg}
                onRetry={() => fetchTrace(traceId)}
                emptyMessage={traceId ? 'No trace data found for this request.' : 'Select or make a request to view decision trace.'}
            >
                {traceData && (
                    <div className="space-y-4">
                        <div className="p-3 bg-gray-900 rounded-lg text-green-400 font-mono text-xs overflow-x-auto shadow-inner">
                            <div className="flex items-center text-gray-400 mb-2 pb-2 border-b border-gray-800">
                                <Code className="w-4 h-4 mr-2" />
                                <span>Execution Plan</span>
                            </div>
                            <pre>{JSON.stringify(traceData.plan || traceData, null, 2)}</pre>
                        </div>

                        {traceData.sub_tasks && traceData.sub_tasks.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                                    <GitMerge className="w-3 h-3 mr-1" /> Agent Delegation
                                </h4>
                                {traceData.sub_tasks.map((task, idx) => (
                                    <div key={idx} className="p-3 border border-indigo-100 bg-indigo-50/50 rounded-lg">
                                        <div className="font-semibold text-sm text-indigo-900">{task.agent}</div>
                                        <div className="text-xs text-indigo-700 mt-1">{task.instruction}</div>
                                        <div className={`mt-2 text-[10px] font-mono px-2 py-1 rounded inline-block ${task.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {task.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </StateWrapper>
        </div>
    );
};

export default DecisionTraceViewer;
