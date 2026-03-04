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
        const propertyLink = screen.getByText('Property & Booking').closest('a');
        expect(propertyLink).toHaveAttribute('href', '/property');
        const crmLink = screen.getByText('CRM').closest('a');
        expect(crmLink).toHaveAttribute('href', '/crm');
        const hrLink = screen.getByText('HR').closest('a');
        expect(hrLink).toHaveAttribute('href', '/hr');
        const financeLink = screen.getByText('Finance').closest('a');
        expect(financeLink).toHaveAttribute('href', '/finance');

        const dashboardLink = screen.getByText('Agent Dashboard').closest('a');
        expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('displays the System Online status indicator', () => {
        renderWithRouter();
        expect(screen.getByText('System Online')).toBeInTheDocument();
    });

    it('applies active styling to the matched route', () => {
        // Render starting already on the /finance route
        renderWithRouter('/finance');

        const financeLink = screen.getByText('Finance').closest('a');
        const masterAiLink = screen.getByText('Master AI').closest('a');
        const dashboardLink = screen.getByText('Agent Dashboard').closest('a');

        // NavLink applies an inner class via a callback. We test that the custom classes apply.
        expect(financeLink).toHaveClass('bg-indigo-50');
        expect(financeLink).toHaveClass('text-indigo-700');

        // The unselected link should have the default classes
        expect(masterAiLink).toHaveClass('text-gray-500');
        expect(masterAiLink).not.toHaveClass('bg-indigo-50');

        expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });
});
