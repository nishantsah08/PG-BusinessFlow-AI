import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { UIProvider } from '../../context/UIContext';
import NotificationSystem from '../common/NotificationSystem';
import AgentDashboard from './AgentDashboard';

jest.mock('../../hooks/useRealtimeSource', () => jest.fn(() => ({ connected: true, error: null })));

const renderWithContext = (component) => {
    return render(
        <UIProvider>
            {component}
            <NotificationSystem />
        </UIProvider>
    );
};

describe('AgentDashboard architecture rendering', () => {
    let originalFetch;

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    afterEach(() => {
    });

    it('renders empty state if no agents returned', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true, data: { agents: [] } })
        });

        renderWithContext(<AgentDashboard />);

        expect(await screen.findByText(/No agents currently registered/i)).toBeInTheDocument();
    });

    it('renders success state and renders AgentCards', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    agents: [
                        { name: 'CRM_AGENT', status: 'online', last_heartbeat: new Date().toISOString() },
                        { name: 'HR_AGENT', status: 'offline' }
                    ]
                }
            })
        });

        renderWithContext(<AgentDashboard />);

        expect(await screen.findByText('CRM_AGENT')).toBeInTheDocument();

        expect(screen.getByText('HR_AGENT')).toBeInTheDocument();
    });

    it('optimistically reverts toggle and shows toast on API failure', async () => {
        // Initial Fetch
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    agents: [{ name: 'FINANCE_AGENT', status: 'online' }]
                }
            })
        });

        renderWithContext(<AgentDashboard />);
        expect(await screen.findByTestId('card-FINANCE_AGENT')).toHaveAttribute('data-state', 'online');

        // Setup the Action Failure mock as a deferred promise
        let actionResolve;
        global.fetch.mockImplementationOnce(() => new Promise(resolve => {
            actionResolve = resolve;
        }));

        await act(async () => {
            fireEvent.click(screen.getByTestId('toggle-FINANCE_AGENT'));
        });

        // Lifecycle strictly shows processing badge, prevents silent reverts, keeps existing data-state
        expect(await screen.findByText(/Processing\.\.\./i)).toBeInTheDocument();
        expect(screen.getByTestId('card-FINANCE_AGENT')).toHaveAttribute('data-state', 'online');

        // Resolve the fetch to fail the action
        await act(async () => {
            actionResolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    success: false,
                    error: 'Agent daemon not responding to SIGTERM'
                })
            });
        });

        // It should revert back to red when the request resolves as failed, and drop a toast
        expect(await screen.findByText(/Failed to disable FINANCE_AGENT/i)).toBeInTheDocument();

        // Ensure state reverted
        await waitFor(() => {
            expect(screen.getByTestId('card-FINANCE_AGENT')).toHaveAttribute('data-state', 'online');
        });
    });

    it('invokes restarting payload', async () => {
        // Initial Fetch
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                success: true,
                data: {
                    agents: [{ name: 'CEO_AGENT', status: 'offline' }]
                }
            })
        });

        renderWithContext(<AgentDashboard />);

        expect(await screen.findByText('CEO_AGENT')).toBeInTheDocument();

        // Setup the Action Success mock as a deferred promise
        let actionResolve;
        global.fetch.mockImplementationOnce(() => new Promise(resolve => {
            actionResolve = resolve;
        }));

        // Setup the Refresh fetch mock as a deferred promise
        let refreshResolve;
        global.fetch.mockImplementationOnce(() => new Promise(resolve => {
            refreshResolve = resolve;
        }));

        const restartBtn = screen.getByTestId('restart-CEO_AGENT');
        await act(async () => {
            fireEvent.click(restartBtn);
        });

        // AgentCard shows explicit processing badge
        expect(await screen.findByText(/Processing\.\.\./i)).toBeInTheDocument();
        expect(screen.getByTestId('card-CEO_AGENT')).toHaveAttribute('data-state', 'offline');

        // Resolve the Action POST mock
        await act(async () => {
            actionResolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ success: true })
            });
        });

        // Resolve the Dashboard GET refresh mock
        await act(async () => {
            refreshResolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    success: true,
                    data: {
                        agents: [{ name: 'CEO_AGENT', status: 'online' }]
                    }
                })
            });
        });

        // Since it succeeds, `AgentCard` triggers `onActionSuccess` -> `fetchAgents()`
        // It should now be online according to the refresh mock
        await waitFor(() => {
            expect(screen.getByTestId('card-CEO_AGENT')).toHaveAttribute('data-state', 'online');
        });

        // It should have called the API twice (control endpoint + refresh)
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
