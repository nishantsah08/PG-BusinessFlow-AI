import React from 'react';
import { render, screen } from '@testing-library/react';
import LatencyDisplay from './LatencyDisplay';

describe('LatencyDisplay Core Architectural States', () => {

    it('renders the empty state when no logs are provided', () => {
        render(<LatencyDisplay logs={[]} />);
        expect(screen.getByText(/No API requests have been made yet/i)).toBeInTheDocument();
    });

    it('renders the success state with RequestLogItems when logs are provided', () => {
        const mockLogs = [
            {
                correlationId: 'corr-123',
                latencyMs: 150,
                success: true,
                endpoint: 'GET /api/test'
            },
            {
                correlationId: 'corr-456',
                latencyMs: 50,
                success: false,
                endpoint: 'POST /api/test',
                errorMessage: 'Rate limited'
            }
        ];

        render(<LatencyDisplay logs={mockLogs} />);

        // StateWrapper shouldn't show empty message
        expect(screen.queryByText(/No API requests have been made yet/i)).not.toBeInTheDocument();

        // Verify transparent log data is displayed via RequestLogItem
        expect(screen.getByText(/corr-123/i)).toBeInTheDocument();
        expect(screen.getByText(/150ms/i)).toBeInTheDocument();
        expect(screen.getByText(/GET \/api\/test/i)).toBeInTheDocument();

        expect(screen.getByText(/corr-456/i)).toBeInTheDocument();
        expect(screen.getByText(/Rate limited/i)).toBeInTheDocument();
    });
});
