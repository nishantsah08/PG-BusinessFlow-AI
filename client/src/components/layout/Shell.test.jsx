import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import Shell from './Shell';

// Polyfill for TextEncoder/TextDecoder required by react-router-dom in jest-environment-jsdom
if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}

// We mock the child components to test just the Shell layout
jest.mock('./TopBar', () => () => <div data-testid="mock-topbar" />);
jest.mock('./Sidebar', () => () => <div data-testid="mock-sidebar" />);

describe('Shell Layout Component', () => {
    it('renders the TopBar, Sidebar, and the injected Outlet content', () => {
        // Since Shell uses <Outlet />, we wrap it in Routes to simulate routing injection
        render(
            <MemoryRouter initialEntries={['/test']}>
                <Routes>
                    <Route element={<Shell />}>
                        <Route path="test" element={<div data-testid="test-outlet-content">Hello Outlet</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        // Core layout elements should be present
        expect(screen.getByTestId('mock-topbar')).toBeInTheDocument();
        expect(screen.getByTestId('mock-sidebar')).toBeInTheDocument();

        // Outlet injected component must be present
        expect(screen.getByTestId('test-outlet-content')).toBeInTheDocument();
        expect(screen.getByText('Hello Outlet')).toBeInTheDocument();
    });
});
