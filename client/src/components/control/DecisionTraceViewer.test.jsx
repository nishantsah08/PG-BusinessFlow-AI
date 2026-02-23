import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DecisionTraceViewer from './DecisionTraceViewer';

describe('DecisionTraceViewer Core Architectural States', () => {
    let originalFetch;
    const mockOnLogRequest = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        originalFetch = global.fetch;
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('renders the empty state when no traceId is provided', () => {
        render(<DecisionTraceViewer traceId={null} onLogRequest={mockOnLogRequest} />);
        expect(screen.getByText(/Select or make a request to view decision trace/i)).toBeInTheDocument();
    });

    it('renders loading state then transitions to success', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    plan: { step: 1 },
                    sub_tasks: [
                        { agent: 'CEO_AGENT', instruction: 'Review', status: 'completed' }
                    ]
                },
                correlation_id: 'corr-123',
                latency_ms: 10
            })
        });

        render(<DecisionTraceViewer traceId="trace-1" onLogRequest={mockOnLogRequest} />);

        // Loading initially
        expect(screen.getByText(/loading/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Execution Plan/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/CEO_AGENT/i)).toBeInTheDocument();
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(mockOnLogRequest).toHaveBeenCalled();
    });

    it('renders empty state if the trace endpoint returns a missing/404 indicator', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: false,
                error: 'Trace 404 not found'
            })
        });

        render(<DecisionTraceViewer traceId="trace-missing" onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText(/No trace data found for this request/i)).toBeInTheDocument();
        });
    });

    it('renders error state if the fetch fails completely and handles retry', async () => {
        global.fetch.mockRejectedValue(new Error('Network disconnected'));

        render(<DecisionTraceViewer traceId="trace-error" onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText(/Network disconnected/i)).toBeInTheDocument();
        });

        // Setup success for retry
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: { plan: { recovered: true } },
                correlation_id: 'corr-123'
            })
        });

        const retryBtn = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(screen.getByText(/Execution Plan/i)).toBeInTheDocument();
        });
    });
});
