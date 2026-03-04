import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StateWrapper from './StateWrapper';

describe('StateWrapper Core Architectural States', () => {

    it('renders the loading state', () => {
        render(
            <StateWrapper state="loading">
                <div data-testid="child">Content</div>
            </StateWrapper>
        );
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
        expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    });

    it('renders the success state with children', () => {
        render(
            <StateWrapper state="success">
                <div data-testid="child">Content</div>
            </StateWrapper>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders the empty state with default message', () => {
        render(
            <StateWrapper state="empty">
                <div data-testid="child">Content</div>
            </StateWrapper>
        );
        expect(screen.getByText(/no data available/i)).toBeInTheDocument();
        expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    });

    it('renders the empty state with custom message', () => {
        render(
            <StateWrapper state="empty" emptyMessage="No workflows found.">
                <div data-testid="child">Content</div>
            </StateWrapper>
        );
        expect(screen.getByText(/no workflows found/i)).toBeInTheDocument();
    });

    it('renders the error state and handles retry (5th state)', () => {
        const handleRetry = jest.fn();
        render(
            <StateWrapper state="error" error="Network timeout" onRetry={handleRetry}>
                <div data-testid="child">Content</div>
            </StateWrapper>
        );

        expect(screen.getByText(/network timeout/i)).toBeInTheDocument();
        expect(screen.queryByTestId('child')).not.toBeInTheDocument();

        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();

        fireEvent.click(retryButton);
        expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('renders fallback for invalid state', () => {
        render(
            <StateWrapper state="unknown_broken_state">
                <div data-testid="child">Content</div>
            </StateWrapper>
        );
        expect(screen.getByText(/invalid component state/i)).toBeInTheDocument();
    });
});
