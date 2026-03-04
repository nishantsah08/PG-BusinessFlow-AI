import { useState, useEffect, useRef } from 'react';

/**
 * useRealtimeSource
 * 
 * Provides an abstraction over Server-Sent Events (SSE) / WebSockets
 * so components can subscribe to real-time streams without knowing
 * the underlying transport protocol.
 * 
 * @param {string} url - The streaming endpoint.
 * @param {function} onEventCallback - Callback triggered when an event arrives.
 */
export const useRealtimeSource = (url, onEventCallback) => {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const callbackRef = useRef(onEventCallback);

    // Keep callback fresh without re-triggering the connection
    useEffect(() => {
        callbackRef.current = onEventCallback;
    }, [onEventCallback]);

    useEffect(() => {
        if (!url) return;

        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            setConnected(true);
            setError(null);
        };

        eventSource.onerror = (err) => {
            console.error('RealtimeSource Connection Error on', url);
            setConnected(false);
            setError('Connection lost. Reconnecting...');
            // EventSource natively auto-reconnects
        };

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (callbackRef.current) {
                    callbackRef.current(data);
                }
            } catch (err) {
                console.warn('RealtimeSource Parse Error:', err);
            }
        };

        return () => {
            eventSource.close();
            setConnected(false);
        };
    }, [url]);

    return { connected, error };
};

export default useRealtimeSource;
