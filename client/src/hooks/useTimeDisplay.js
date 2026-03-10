import { useSettings } from '../context/SettingsContext';

/**
 * useTimeDisplay
 * Hook to format timestamps based on user settings.
 */
export const useTimeDisplay = () => {
    const { settings } = useSettings();
    const resolvedSettings = {
        timezone: settings?.timezone || settings?.timeZone || 'Asia/Kolkata',
        date_format: settings?.date_format || 'DD-MM-YYYY',
        time_format: settings?.time_format || (settings?.format24h ? '24h' : '12h')
    };

    const formatTime = (isoString) => {
        if (!isoString) return '';

        try {
            const date = new Date(isoString);

            // Note: date-fns-tz is not in client package.json.
            // For now, we will use Intl.DateTimeFormat which is well-supported.

            const dateStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: resolvedSettings.timezone,
                year: resolvedSettings.date_format.includes('YYYY') ? 'numeric' : '2-digit',
                month: '2-digit',
                day: '2-digit',
            }).format(date).replace(/\//g, resolvedSettings.date_format.includes('/') ? '/' : '-');

            // Re-ordering if needed based on date_format
            let finalDate = dateStr;
            const parts = dateStr.split(/[-/]/); // day, month, year
            if (resolvedSettings.date_format.startsWith('MM')) {
                finalDate = `${parts[1]}${resolvedSettings.date_format[2]}${parts[0]}${resolvedSettings.date_format[2]}${parts[2]}`;
            } else if (resolvedSettings.date_format.startsWith('YYYY')) {
                finalDate = `${parts[2]}${resolvedSettings.date_format[4]}${parts[1]}${resolvedSettings.date_format[4]}${parts[0]}`;
            }

            const timeStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: resolvedSettings.timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: resolvedSettings.time_format === '12h'
            }).format(date);

            return {
                date: finalDate,
                time: timeStr,
                timezone: resolvedSettings.timezone
            };
        } catch (e) {
            console.error('Error formatting time:', e);
            return { date: isoString, time: '', timezone: '' };
        }
    };

    return { formatTime };
};

export default useTimeDisplay;
