import React, { useState, useEffect } from 'react';
import { Activity, RefreshCcw } from 'lucide-react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import useRealtimeSource from '../../hooks/useRealtimeSource';

/**
 * EventViewer Component
 * Polled log of system events from MasterAI.
 * 
 * Configured to meet strict requirements:
 * 1. 5-state aware
 * 2. Fetches via apiClient ONLY
 * 3. Local component state only (forbidden global data)
 */
const EventViewer = ({ onLogRequest }) => {
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'empty' | 'error'
    const [events, setEvents] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);

    const fetchEvents = async (silent = false) => {
        if (!silent) {
            setStatus('loading');
            setErrorMsg(null);
        }

        try {
            const response = await apiClient.get('/api/master_ai/events?limit=20');

            // Log transparency
            onLogRequest({
                correlationId: response.correlation_id,
                latencyMs: response.latency_ms,
                success: response.success,
                endpoint: 'GET /api/master_ai/events',
                errorMessage: response.error
            });

            if (response.success) {
                const fetchedEvents = response.data?.events || [];
                setEvents(fetchedEvents);
                setStatus(fetchedEvents.length === 0 ? 'empty' : 'success');
            } else {
                throw new Error(response.error || 'Failed to fetch events');
            }
        } catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
            console.error(err);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    useRealtimeSource('/api/system/events/stream', (event) => {
        if (event && event.event_type && event.event_type !== 'ping' && event.event_type !== 'stream.connected') {
            setEvents(prev => {
                const newEvt = {
                    type: event.event_type,
                    timestamp: event.timestamp,
                    message: event.payload ? JSON.stringify(event.payload) : event.event_type,
                    agent_id: event.source?.name
                };
                return [newEvt, ...prev].slice(0, 50); // Keep last 50
            });
            setStatus('success');
        }
    });

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <span className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                    <Activity className="w-3 h-3 mr-1" />
                    Live Events
                </span>
                <button
                    onClick={() => fetchEvents(false)}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                >
                    <RefreshCcw className="w-3 h-3" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <StateWrapper
                    state={status}
                    error={errorMsg}
                    onRetry={() => fetchEvents(false)}
                    emptyMessage="No system events captured yet."
                >
                    <div className="space-y-2">
                        {events.map((evt, idx) => (
                            <div key={idx} className="p-2 bg-white border border-gray-100 rounded-md shadow-sm text-xs">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono font-bold text-indigo-600">{evt.type || 'EVENT'}</span>
                                    <span className="text-gray-400 text-[10px]">{new Date(evt.timestamp || Date.now()).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-gray-600 truncate">{evt.message || JSON.stringify(evt.payload)}</div>
                                {evt.agent_id && (
                                    <div className="mt-1 text-[10px] font-mono bg-gray-100 text-gray-500 px-1 py-0.5 rounded inline-block">
                                        Agent: {evt.agent_id}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </StateWrapper>
            </div>
        </div>
    );
};

export default EventViewer;
