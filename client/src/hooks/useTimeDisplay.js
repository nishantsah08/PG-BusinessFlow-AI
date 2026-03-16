import { useSettings } from '../context/SettingsContext';
import { formatPortalDateTime } from '../lib/dateDisplay';

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
            const formatted = formatPortalDateTime({
                value: isoString,
                timezone: resolvedSettings.timezone,
                dateFormat: resolvedSettings.date_format,
                timeFormat: resolvedSettings.time_format,
            });
            return {
                date: formatted.date,
                time: formatted.time,
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
