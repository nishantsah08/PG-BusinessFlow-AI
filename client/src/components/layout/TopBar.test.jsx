import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopBar from './TopBar';
import { useAuth } from '../../context/AuthContext';

// Mock the AuthContext hook
jest.mock('../../context/AuthContext', () => ({
    useAuth: jest.fn()
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
    Settings: () => <div data-testid="settings-icon" />,
    LogOut: () => <div data-testid="logout-icon" />,
    Code: () => <div data-testid="code-icon" />,
    User: () => <div data-testid="user-icon" />
}));

describe('TopBar Component', () => {
    const mockLogout = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        // Provide mock implementation for useAuth
        useAuth.mockReturnValue({ logout: mockLogout });
    });

    it('renders the branding logo and text', () => {
        render(<TopBar />);

        expect(screen.getByText('PG')).toBeInTheDocument();
        expect(screen.getByText('pgbusinessflow')).toBeInTheDocument();
        expect(screen.getByText('.ai')).toBeInTheDocument();
    });

    it('renders the Settings button and opens dropdown to reveal Logout', () => {
        render(<TopBar />);

        expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();

        // Logout is hidden initially
        expect(screen.queryByText('Log out securely')).not.toBeInTheDocument();

        // Click settings to open dropdown
        fireEvent.click(screen.getByText('Settings').closest('button'));

        expect(screen.getByTestId('logout-icon')).toBeInTheDocument();
        expect(screen.getByText('Log out securely')).toBeInTheDocument();
    });

    it('calls the logout function from AuthContext when Logout is clicked', () => {
        render(<TopBar />);

        // Open dropdown first
        fireEvent.click(screen.getByText('Settings').closest('button'));

        const logoutButton = screen.getByText('Log out securely').closest('button');
        fireEvent.click(logoutButton);

        expect(mockLogout).toHaveBeenCalledTimes(1);
    });
});
