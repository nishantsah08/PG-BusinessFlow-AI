import React, { useState, useEffect, useCallback } from 'react';
import ChatPanel from '../components/control/ChatPanel';
import RightPanel from '../components/control/RightPanel';
/**
 * ControlPanel Page
 * Orchestrator for Phase 2 components.
 * Manages local component state, fetching via API client, and applying StateWrappers.
 */
const ControlPanel = () => {
    // Shared state between components (passed down)
    const [lastTraceId, setLastTraceId] = useState(null);
    const [requestLogs, setRequestLogs] = useState([]);

    // Toggle for the right observation panel
    const [isDevViewOpen, setIsDevViewOpen] = useState(true);

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
            {/* Left Column: Chat and Interaction (Expands when panel is hidden) */}
            <div className={`w-full ${isDevViewOpen ? 'md:w-3/5' : 'md:flex-1'} h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-gray-200 transition-all duration-300`}>
                <div className="flex-1 overflow-hidden relative bg-gray-50/50">
                    <ChatPanel onLogRequest={handleLogRequest} />
                </div>
            </div>

            {/* Right Column: Transparency, Tracing, and Workflows */}
            <RightPanel
                isOpen={isDevViewOpen}
                onToggle={() => setIsDevViewOpen(!isDevViewOpen)}
                onLogRequest={handleLogRequest}
                lastTraceId={lastTraceId}
                requestLogs={requestLogs}
            />
        </div>
    );
};

export default ControlPanel;
