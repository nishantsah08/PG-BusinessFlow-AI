import React, { useState, useEffect, useCallback } from 'react';
import ChatPanel from '../components/control/ChatPanel';
import EventViewer from '../components/control/EventViewer';
import DecisionTraceViewer from '../components/control/DecisionTraceViewer';
import LatencyDisplay from '../components/control/LatencyDisplay';

/**
 * ControlPanel Page
 * Orchestrator for Phase 2 components.
 * Manages local component state, fetching via API client, and applying StateWrappers.
 */
const ControlPanel = () => {
    // Shared state between components (passed down)
    const [lastTraceId, setLastTraceId] = useState(null);
    const [requestLogs, setRequestLogs] = useState([]);

    // Callback to append transparent logs from children
    const handleLogRequest = useCallback((logEntry) => {
        // logEntry shape must match RequestLogItemProps
        setRequestLogs(prev => [logEntry, ...prev].slice(0, 50)); // Keep last 50
        if (logEntry.correlationId) {
            setLastTraceId(logEntry.correlationId);
        }
    }, []);

    return (
        <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white">
            {/* Left Column: Chat and Interaction (60%) */}
            <div className="w-full md:w-3/5 h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-gray-200">
                <div className="flex-1 overflow-hidden relative bg-gray-50/50">
                    <ChatPanel onLogRequest={handleLogRequest} />
                </div>
            </div>

            {/* Right Column: Transparency and Tracing (40%) */}
            <div className="w-full md:w-2/5 h-1/2 md:h-full flex flex-col bg-gray-50 overflow-hidden">
                {/* Top Half: Event and State Viewer */}
                <div className="flex-1 border-b border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-3 bg-white border-b border-gray-100 font-semibold text-sm text-gray-700 shrink-0">
                        System Observation
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <EventViewer onLogRequest={handleLogRequest} />
                    </div>
                </div>

                {/* Bottom Half: Decision Trace and Latency */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 border-b border-gray-200 overflow-hidden relative">
                        <div className="p-3 bg-white border-b border-gray-100 font-semibold text-sm text-gray-700 flex justify-between items-center absolute top-0 left-0 right-0 z-10 shadow-sm">
                            <span>Decision Trace</span>
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded border">
                                {lastTraceId ? lastTraceId.substring(0, 8) + '...' : 'Waiting...'}
                            </span>
                        </div>
                        <div className="h-full pt-12 overflow-y-auto p-4">
                            <DecisionTraceViewer traceId={lastTraceId} onLogRequest={handleLogRequest} />
                        </div>
                    </div>

                    {/* Latency / Request Log History */}
                    <div className="h-48 shrink-0 overflow-hidden flex flex-col bg-white">
                        <div className="p-2 bg-gray-100 border-b border-gray-200 font-semibold text-xs text-gray-600 shrink-0">
                            Request Latency Log
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
                            <LatencyDisplay logs={requestLogs} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
