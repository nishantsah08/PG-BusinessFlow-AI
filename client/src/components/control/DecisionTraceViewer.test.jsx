import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DecisionTraceViewer from './DecisionTraceViewer';

import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
    get: jest.fn()
}));

describe('DecisionTraceViewer Core Architectural States', () => {
    const mockOnLogRequest = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the empty state when no traceId is provided', () => {
        render(<DecisionTraceViewer traceId={null} onLogRequest={mockOnLogRequest} />);
        expect(screen.getByText(/Select or make a request to view decision trace/i)).toBeInTheDocument();
    });

    it('renders loading state then transitions to success', async () => {
        apiClient.get.mockResolvedValue({
            success: true,
            data: {
                plan: "Execution Plan Generated",
                sub_tasks: [
                    { agent: 'CEO_AGENT', instruction: 'Review', status: 'completed' }
                ]
            }
        });

        render(<DecisionTraceViewer traceId="trace-1" onLogRequest={mockOnLogRequest} />);

        // Loading initially
        expect(screen.getByText(/loading/i)).toBeInTheDocument();

        // The header is "Execution Plan", wait for it
        await waitFor(() => {
            expect(screen.getByText('Execution Plan')).toBeInTheDocument();
        });

        // The data is inside the pre tag
        expect(screen.getByText(/Execution Plan Generated/i)).toBeInTheDocument();

        expect(screen.getByText(/CEO_AGENT/i)).toBeInTheDocument();
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
    });

    it('renders empty state if the trace endpoint returns a missing/404 indicator', async () => {
        apiClient.get.mockResolvedValue({
            success: false,
            error: 'Trace 404 not found'
        });

        render(<DecisionTraceViewer traceId="trace-missing" onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText(/No trace data found for this request/i)).toBeInTheDocument();
        });
    });

    it('renders error state if the fetch fails completely and handles retry', async () => {
        apiClient.get.mockResolvedValue({
            success: false,
            error: 'Network disconnected'
        });

        render(<DecisionTraceViewer traceId="trace-error" onLogRequest={mockOnLogRequest} />);

        await waitFor(() => {
            expect(screen.getByText(/Network disconnected/i)).toBeInTheDocument();
        });

        // Setup success for retry
        apiClient.get.mockResolvedValue({
            success: true,
            data: { plan: { recovered: true } }
        });

        const retryBtn = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(screen.getByText(/Execution Plan/i)).toBeInTheDocument();
        });
    });
});
