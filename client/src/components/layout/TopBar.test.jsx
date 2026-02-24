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
    LogOut: () => <div data-testid="logout-icon" />
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

    it('renders the Settings and Logout buttons', () => {
        render(<TopBar />);

        expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();

        expect(screen.getByTestId('logout-icon')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('calls the logout function from AuthContext when Logout is clicked', () => {
        render(<TopBar />);

        const logoutButton = screen.getByText('Logout').closest('button');
        fireEvent.click(logoutButton);

        expect(mockLogout).toHaveBeenCalledTimes(1);
    });
});
