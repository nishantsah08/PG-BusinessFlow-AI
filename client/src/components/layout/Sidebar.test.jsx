import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Sidebar from './Sidebar';

// Polyfill for TextEncoder/TextDecoder required by react-router-dom in jest-environment-jsdom
if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}

describe('Sidebar Component', () => {

    // We must wrap the Sidebar in a Router because it uses NavLink
    const renderWithRouter = (initialRoute = '/') => {
        return render(
            <MemoryRouter initialEntries={[initialRoute]}>
                <Sidebar />
            </MemoryRouter>
        );
    };

    it('renders all navigation links properly', () => {
        renderWithRouter();

        const masterAiLink = screen.getByText('Master AI').closest('a');
        expect(masterAiLink).toHaveAttribute('href', '/master');

        const dashboardLink = screen.getByText('Agent Dashboard').closest('a');
        expect(dashboardLink).toHaveAttribute('href', '/dashboard');

        const monitorLink = screen.getByText('Workflow Monitor').closest('a');
        expect(monitorLink).toHaveAttribute('href', '/monitor');
    });

    it('displays the System Online status indicator', () => {
        renderWithRouter();
        expect(screen.getByText('System Online')).toBeInTheDocument();
    });

    it('applies active styling to the matched route', () => {
        // Render starting already on the /dashboard route
        renderWithRouter('/dashboard');

        const dashboardLink = screen.getByText('Agent Dashboard').closest('a');
        const masterAiLink = screen.getByText('Master AI').closest('a');

        // NavLink applies an inner class via a callback. We test that the custom classes apply.
        expect(dashboardLink).toHaveClass('bg-indigo-50');
        expect(dashboardLink).toHaveClass('text-indigo-700');

        // The unselected link should have the default classes
        expect(masterAiLink).toHaveClass('text-gray-500');
        expect(masterAiLink).not.toHaveClass('bg-indigo-50');
    });
});
