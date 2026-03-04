import React, { useState } from 'react';
import EventViewer from './EventViewer';
import DecisionTraceViewer from './DecisionTraceViewer';
import LatencyDisplay from './LatencyDisplay';

/**
 * SystemObservationPanel
 * Stacked card view replacing the vertical layout for AI debugging info.
 * Supports toggling the full view on/off from the parent.
 */
const SystemObservationPanel = ({
    onLogRequest,
    lastTraceId,
    requestLogs
}) => {
    // Determine which card is 'active' in the stack.
    const [activeTab, setActiveTab] = useState('events');

    return (
        <div className="absolute inset-0 flex flex-col w-full h-full">

            {/* Overlapping Cards Container */}
            <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col relative">

                {/* Tab Selectors (The visible tops of the cards) */}
                <div className="flex space-x-1 shrink-0 z-10 px-2 relative -mb-px">
                    {[
                        { id: 'events', label: 'Live Events' },
                        { id: 'trace', label: 'Decision Trace' },
                        { id: 'latency', label: 'Network & Latency' }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    py-2 px-3 md:px-4 text-xs font-semibold rounded-t-lg transition-all duration-200 border
                                    ${isActive
                                        ? 'bg-white border-gray-200 border-b-transparent text-blue-700 z-20 relative'
                                        : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200 z-0'}
                                `}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* The Active Card Content area */}
                <div className="flex-1 bg-white border border-gray-200 rounded-lg rounded-tl-none shadow-sm flex flex-col overflow-hidden relative z-10">

                    {activeTab === 'events' && (
                        <div className="flex-1 overflow-hidden flex flex-col animate-fadeIn">
                            <div className="p-2 border-b border-gray-100 bg-gray-50/50 text-xs font-mono text-gray-400 flex justify-between shrink-0">
                                <span>WebSocket Stream</span>
                                <span className="text-green-500 flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>Live
                                </span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <EventViewer onLogRequest={onLogRequest} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'trace' && (
                        <div className="flex-1 overflow-hidden flex flex-col animate-fadeIn">
                            <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex justify-between shrink-0 items-center">
                                <span className="text-xs font-mono text-gray-400">Execution Plan</span>
                                <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shadow-inner">
                                    Trace ID: {lastTraceId ? lastTraceId : 'Waiting...'}
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-gray-50/30">
                                <DecisionTraceViewer traceId={lastTraceId} onLogRequest={onLogRequest} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'latency' && (
                        <div className="flex-1 overflow-hidden flex flex-col animate-fadeIn">
                            <div className="p-2 border-b border-gray-100 bg-gray-50/50 text-xs font-mono text-gray-400 shrink-0">
                                API Request Logs
                            </div>
                            <div className="flex-1 overflow-y-auto bg-gray-50 p-2">
                                <LatencyDisplay logs={requestLogs} />
                            </div>
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
};

export default SystemObservationPanel;
