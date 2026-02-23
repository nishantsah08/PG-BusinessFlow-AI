import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventViewer from './EventViewer';

export let mockSseCallback = null;
jest.mock('../../hooks/useRealtimeSource', () => jest.fn((url, cb) => {
    mockSseCallback = cb;
    return { connected: true, error: null };
}));

describe('EventViewer Core Architectural States', () => {
    let originalFetch;
    const mockOnLogRequest = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        originalFetch = global.fetch;
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        global.fetch = originalFetch;
    });

    it('renders initial loading state then transitions to success', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    events: [
                        { type: 'SYSTEM_START', timestamp: new Date().toISOString(), message: 'Hello' }
                    ]
                },
                correlation_id: '123',
                latency_ms: 10
            })
        });

        render(<EventViewer onLogRequest={mockOnLogRequest} />);

        // Initial render should show loader
        expect(screen.getByText(/loading/i)).toBeInTheDocument();

        // Wait for fetch to resolve
        await waitFor(() => {
            expect(screen.getByText('SYSTEM_START')).toBeInTheDocument();
        });
    });

    it('renders empty state if no events exist', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: { events: [] }
            })
        });

        render(<EventViewer onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText(/No system events captured yet/i)).toBeInTheDocument();
        });
    });

    it('renders error state if fetch fails and handles retry', async () => {
        global.fetch.mockRejectedValue(new Error('Network failure'));

        render(<EventViewer onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
        });

        // Setup success for the retry
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    events: [{ type: 'RECOVERY', timestamp: new Date().toISOString(), message: 'recovered' }]
                }
            })
        });

        const retryBtn = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(screen.getByText('RECOVERY')).toBeInTheDocument();
        });
    });

    it('appends new events reactively via SSE stream', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    events: [{ type: 'EVENT_1', timestamp: new Date().toISOString() }]
                }
            })
        });

        render(<EventViewer onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText('EVENT_1')).toBeInTheDocument();
        });

        // Simulate SSE event
        const { act } = require('@testing-library/react');
        act(() => {
            if (mockSseCallback) {
                mockSseCallback({
                    event_type: 'EVENT_2',
                    timestamp: new Date().toISOString(),
                    payload: { info: "Streamed event" },
                    source: { name: "System" }
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText('EVENT_2')).toBeInTheDocument();
            expect(screen.getByText(/Streamed event/i)).toBeInTheDocument();
        });

        // Ensures the spinner hasn't popped up because it's a reactive append
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
});
