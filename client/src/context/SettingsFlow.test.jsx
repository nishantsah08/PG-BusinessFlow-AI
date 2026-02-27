import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../context/SettingsContext';
import { useTimeDisplay } from '../hooks/useTimeDisplay';

const TestComponent = ({ isoString }) => {
    const { settings, updateSettings } = useSettings();
    const { formatTime } = useTimeDisplay();
    const formatted = formatTime(isoString);

    return (
        <div>
            <div data-testid="date">{formatted.date}</div>
            <div data-testid="time">{formatted.time}</div>
            <div data-testid="timezone">{formatted.timezone}</div>
            <button onClick={() => updateSettings({ date_format: 'YYYY-MM-DD' })}>Change Format</button>
            <button onClick={() => updateSettings({ timezone: 'Europe/London' })}>Change Timezone</button>
            <button onClick={() => updateSettings({ time_format: '24h' })}>Change Time Format</button>
        </div>
    );
};

describe('Settings & Time Presentation Flow', () => {
    const testIST = '2026-02-27T14:30:00+05:30'; // 2:30 PM IST

    beforeEach(() => {
        localStorage.clear();
    });

    test('should format time correctly with default settings (IST, DD-MM-YYYY, 12h)', () => {
        render(
            <SettingsProvider>
                <TestComponent isoString={testIST} />
            </SettingsProvider>
        );

        expect(screen.getByTestId('date').textContent).toBe('27-02-2026');
        expect(screen.getByTestId('time').textContent).toContain('02:30');
        expect(screen.getByTestId('time').textContent).toMatch(/PM|pm/);
        expect(screen.getByTestId('timezone').textContent).toBe('Asia/Kolkata');
    });

    test('should update display when date format changes', () => {
        render(
            <SettingsProvider>
                <TestComponent isoString={testIST} />
            </SettingsProvider>
        );

        act(() => {
            screen.getByText('Change Format').click();
        });

        expect(screen.getByTestId('date').textContent).toBe('2026-02-27');
    });

    test('should update display when timezone changes', () => {
        render(
            <SettingsProvider>
                <TestComponent isoString={testIST} />
            </SettingsProvider>
        );

        act(() => {
            screen.getByText('Change Timezone').click();
        });

        // 2:30 PM IST = 9:00 AM UTC (London in Feb)
        expect(screen.getByTestId('time').textContent).toContain('09:00');
        expect(screen.getByTestId('timezone').textContent).toBe('Europe/London');
    });

    test('should update display when time format changes to 24h', () => {
        render(
            <SettingsProvider>
                <TestComponent isoString={testIST} />
            </SettingsProvider>
        );

        act(() => {
            screen.getByText('Change Time Format').click();
        });

        expect(screen.getByTestId('time').textContent).toBe('14:30');
    });

    test('should persist settings in localStorage', () => {
        const { unmount } = render(
            <SettingsProvider>
                <TestComponent isoString={testIST} />
            </SettingsProvider>
        );

        act(() => {
            screen.getByText('Change Format').click();
        });

        unmount();

        render(
            <SettingsProvider>
                <TestComponent isoString={testIST} />
            </SettingsProvider>
        );

        expect(screen.getByTestId('date').textContent).toBe('2026-02-27');
    });
});
