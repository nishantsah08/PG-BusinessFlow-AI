import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatPanel from './ChatPanel';

describe('ChatPanel Core Architectural States', () => {
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

    it('renders the initial empty state', () => {
        render(<ChatPanel onLogRequest={mockOnLogRequest} />);
        expect(screen.getByText(/Send a message to MasterAI to begin/i)).toBeInTheDocument();
    });

    it('transitions to loading state upon submission', async () => {
        // Freeze fetch promise
        let resolveApi;
        global.fetch.mockReturnValue(new Promise(resolve => {
            resolveApi = resolve;
        }));

        render(<ChatPanel onLogRequest={mockOnLogRequest} />);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Hello' } });
        fireEvent.submit(screen.getByRole('button', { name: '' }));

        // Optimistic UI updates immediately
        expect(screen.getByText('Hello')).toBeInTheDocument();

        // Wait for Loading spinner to appear 
        await waitFor(() => {
            expect(input).toBeDisabled();
        });

        resolveApi({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true, data: { reply: 'Hi back' } })
        });
    });

    it('transitions to success state upon successful response', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: { reply: 'I am MasterAI' },
                correlation_id: '123',
                latency_ms: 50
            })
        });

        render(<ChatPanel onLogRequest={mockOnLogRequest} />);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Who are you?' } });
        fireEvent.submit(screen.getByRole('button', { name: '' }));

        await waitFor(() => {
            expect(screen.getByText('I am MasterAI')).toBeInTheDocument();
        });

        expect(mockOnLogRequest).toHaveBeenCalledWith(expect.objectContaining({
            correlationId: '123',
            success: true
        }));
    });

    it('transitions to error state upon failed response and allows retry', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: false,
                error: 'MasterAI rate limit exceeded',
                correlation_id: '456',
                latency_ms: 10
            })
        });

        render(<ChatPanel onLogRequest={mockOnLogRequest} />);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Crash' } });
        fireEvent.submit(screen.getByRole('button', { name: '' }));

        await waitFor(() => {
            expect(screen.getByText(/MasterAI rate limit exceeded/i)).toBeInTheDocument();
        });

        // The optimistic message should have been popped
        expect(screen.queryByText('Crash')).not.toBeInTheDocument();

        // Retry should reset state to empty
        const retryBtn = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryBtn);

        expect(screen.getByText(/Send a message to MasterAI to begin/i)).toBeInTheDocument();
    });
});
