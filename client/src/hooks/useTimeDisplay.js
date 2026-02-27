import { useSettings } from '../context/SettingsContext';

/**
 * useTimeDisplay
 * Hook to format timestamps based on user settings.
 */
export const useTimeDisplay = () => {
    const { settings } = useSettings();

    const formatTime = (isoString) => {
        if (!isoString) return '';

        try {
            const date = new Date(isoString);

            // Note: date-fns-tz is not in client package.json.
            // For now, we will use Intl.DateTimeFormat which is well-supported.

            const dateStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: settings.timezone,
                year: settings.date_format.includes('YYYY') ? 'numeric' : '2-digit',
                month: '2-digit',
                day: '2-digit',
            }).format(date).replace(/\//g, settings.date_format.includes('/') ? '/' : '-');

            // Re-ordering if needed based on date_format
            let finalDate = dateStr;
            const parts = dateStr.split(/[-/]/); // day, month, year
            if (settings.date_format.startsWith('MM')) {
                finalDate = `${parts[1]}${settings.date_format[2]}${parts[0]}${settings.date_format[2]}${parts[2]}`;
            } else if (settings.date_format.startsWith('YYYY')) {
                finalDate = `${parts[2]}${settings.date_format[4]}${parts[1]}${settings.date_format[4]}${parts[0]}`;
            }

            const timeStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: settings.timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: settings.time_format === '12h'
            }).format(date);

            return {
                date: finalDate,
                time: timeStr,
                timezone: settings.timezone
            };
        } catch (e) {
            console.error('Error formatting time:', e);
            return { date: isoString, time: '', timezone: '' };
        }
    };

    return { formatTime };
};

export default useTimeDisplay;
