import React from 'react';
import StateWrapper from '../common/StateWrapper';
import RequestLogItem from './RequestLogItem';

/**
 * LatencyDisplay Component
 * Displays the historical log of API request latencies and statuses.
 * 
 * Strict compliance:
 * 1. 5-state aware (uses empty state extensively)
 * 2. Visualizes transparent data (RequestLogItem)
 */
const LatencyDisplay = ({ logs = [] }) => {
    // This component receives its state from props (ControlPanel orchestrator)
    const status = logs.length > 0 ? 'success' : 'empty';

    return (
        <div className="h-full w-full">
            <StateWrapper
                state={status}
                emptyMessage="No API requests have been made yet."
            >
                <div className="space-y-2">
                    {logs.map((log, index) => (
                        <RequestLogItem
                            key={log.correlationId || index}
                            correlationId={log.correlationId}
                            latencyMs={log.latencyMs}
                            success={log.success}
                            endpoint={log.endpoint}
                            errorMessage={log.errorMessage}
                        />
                    ))}
                </div>
            </StateWrapper>
        </div>
    );
};

export default LatencyDisplay;
