import React, { useState, useEffect } from 'react';
import SystemObservationPanel from './SystemObservationPanel';
import WorkflowsView from './WorkflowsView';
import { Activity, GitBranch } from 'lucide-react';
import { useDeveloperMode } from '../../context/DeveloperModeContext';

const RightPanel = ({
    isOpen,
    onToggle,
    onLogRequest,
    lastTraceId,
    requestLogs
}) => {
    const { isDeveloperMode } = useDeveloperMode();
    const [activeTopTab, setActiveTopTab] = useState(isDeveloperMode ? 'monitor' : 'workflows');

    // Force switch to workflows if developer mode is turned off while monitor is open
    useEffect(() => {
        if (!isDeveloperMode && activeTopTab === 'monitor') {
            setActiveTopTab('workflows');
        }
    }, [isDeveloperMode, activeTopTab]);

    // --- Closed View ---
    if (!isOpen) {
        return (
            <div className="w-full md:w-12 h-1/2 md:h-full flex flex-col bg-gray-100 border-l border-gray-200 shrink-0 transition-all duration-300 items-center py-4 relative cursor-pointer hover:bg-gray-200" onClick={onToggle}>
                <button
                    className="p-1.5 mb-6 text-gray-500 rounded transition-colors"
                    title="Open Developer View"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div
                    className="hidden md:block text-gray-400 font-bold tracking-[0.2em] text-xs uppercase"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                    System Observation
                </div>
            </div>
        );
    }

    // --- Open View ---
    return (
        <div className="w-full md:w-2/5 h-1/2 md:h-full flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl z-20 transition-all duration-300">
            {/* Header and Toggle */}
            <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">

                {/* Segmented Control for Top Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {isDeveloperMode && (
                        <button
                            onClick={() => setActiveTopTab('monitor')}
                            className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTopTab === 'monitor'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Activity className="w-3.5 h-3.5 mr-1.5" />
                            System Monitor
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTopTab('workflows')}
                        className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTopTab === 'workflows'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                        Workflows
                    </button>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={onToggle}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Close View"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative bg-gray-50">
                {activeTopTab === 'monitor' ? (
                    <SystemObservationPanel
                        onLogRequest={onLogRequest}
                        lastTraceId={lastTraceId}
                        requestLogs={requestLogs}
                    />
                ) : (
                    <WorkflowsView />
                )}
            </div>
        </div>
    );
};

export default RightPanel;
