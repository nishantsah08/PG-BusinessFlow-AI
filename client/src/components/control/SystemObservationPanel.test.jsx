import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // Ensure jest-dom is imported for matchers
import SystemObservationPanel from './SystemObservationPanel';

// Mock child components to isolate our testing to just the Panel's layout/tab logic
jest.mock('./EventViewer', () => () => <div data-testid="mock-event-viewer" />);
jest.mock('./DecisionTraceViewer', () => () => <div data-testid="mock-decision-trace" />);
jest.mock('./LatencyDisplay', () => () => <div data-testid="mock-latency-display" />);

describe('SystemObservationPanel', () => {
    const mockOnToggle = jest.fn();
    const mockOnLogRequest = jest.fn();

    const defaultProps = {
        isOpen: true,
        onToggle: mockOnToggle,
        onLogRequest: mockOnLogRequest,
        lastTraceId: 'trace-123',
        requestLogs: []
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the closed view when isOpen is false', () => {
        render(<SystemObservationPanel {...defaultProps} isOpen={false} />);

        // The toggle button should be present
        expect(screen.getByTitle('Open Developer View')).toBeInTheDocument();

        // The tabs should not be present
        expect(screen.queryByText('Live Events')).not.toBeInTheDocument();
    });

    it('renders the open view with tabs when isOpen is true', () => {
        render(<SystemObservationPanel {...defaultProps} isOpen={true} />);

        expect(screen.getByTitle('Close Developer View')).toBeInTheDocument();

        // Tabs should be visible
        expect(screen.getByText('Live Events')).toBeInTheDocument();
        expect(screen.getByText('Decision Trace')).toBeInTheDocument();
        expect(screen.getByText('Network & Latency')).toBeInTheDocument();
    });

    it('calls onToggle when the toggle buttons are clicked', () => {
        const { rerender } = render(<SystemObservationPanel {...defaultProps} isOpen={false} />);

        // Click to open
        fireEvent.click(screen.getByTitle('Open Developer View'));
        expect(mockOnToggle).toHaveBeenCalledTimes(1);

        // Click to close
        rerender(<SystemObservationPanel {...defaultProps} isOpen={true} />);
        fireEvent.click(screen.getByTitle('Close Developer View'));
        expect(mockOnToggle).toHaveBeenCalledTimes(2);
    });

    it('switches tabs and renders the correct child components', () => {
        render(<SystemObservationPanel {...defaultProps} isOpen={true} />);

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
