import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // Ensure jest-dom is imported for matchers
import SystemObservationPanel from './SystemObservationPanel';

// Mock child components to isolate our testing to just the Panel's layout/tab logic
jest.mock('./EventViewer', () => () => <div data-testid="mock-event-viewer" />);
jest.mock('./DecisionTraceViewer', () => () => <div data-testid="mock-decision-trace" />);
jest.mock('./LatencyDisplay', () => () => <div data-testid="mock-latency-display" />);

describe('SystemObservationPanel', () => {
    const mockOnLogRequest = jest.fn();

    const defaultProps = {
        onLogRequest: mockOnLogRequest,
        lastTraceId: 'trace-123',
        requestLogs: []
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('switches tabs and renders the correct child components', () => {
        render(<SystemObservationPanel {...defaultProps} />);

        // 1. Defaults to 'events'
        expect(screen.getByTestId('mock-event-viewer')).toBeInTheDocument();
        expect(screen.queryByTestId('mock-decision-trace')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mock-latency-display')).not.toBeInTheDocument();

        // 2. Switch to 'trace'
        fireEvent.click(screen.getByText('Decision Trace'));
        expect(screen.queryByTestId('mock-event-viewer')).not.toBeInTheDocument();
        expect(screen.getByTestId('mock-decision-trace')).toBeInTheDocument();
        expect(screen.queryByTestId('mock-latency-display')).not.toBeInTheDocument();

        // 3. Switch to 'latency'
        fireEvent.click(screen.getByText('Network & Latency'));
        expect(screen.queryByTestId('mock-event-viewer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mock-decision-trace')).not.toBeInTheDocument();
        expect(screen.getByTestId('mock-latency-display')).toBeInTheDocument();
    });
});
