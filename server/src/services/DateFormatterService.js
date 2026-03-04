const { formatInTimeZone } = require('date-fns-tz');

/**
 * DateFormatterService
 * Authority: Architecture Layer
 * Objective: Handle presentation-layer date formatting.
 */
class DateFormatterService {
    static ALLOWED_FORMATS = [
        'DD-MM-YYYY',
        'MM-DD-YYYY',
        'YYYY-MM-DD',
        'DD/MM/YYYY'
    ];

    static DEFAULT_FORMAT = 'DD-MM-YYYY';

    /**
     * Map common display formats to date-fns format strings
     */
    static FORMAT_MAP = {
        'DD-MM-YYYY': 'dd-MM-yyyy',
        'MM-DD-YYYY': 'MM-dd-yyyy',
        'YYYY-MM-DD': 'yyyy-MM-dd',
        'DD/MM/YYYY': 'dd/MM/yyyy'
    };

    /**
     * Format an IST timestamp for a specific user timezone and format.
     * @param {string} timestampIST ISO-8601 IST string
     * @param {string} timezone Target timezone (e.g., 'Asia/Kolkata')
     * @param {string} displayFormat Desired format from ALLOWED_FORMATS
     * @returns {Object} { display_date, display_time, display_timezone }
     */
    static format(timestampIST, timezone = 'Asia/Kolkata', displayFormat = 'DD-MM-YYYY') {
        const formatStr = this.FORMAT_MAP[displayFormat] || this.FORMAT_MAP[this.DEFAULT_FORMAT];

        const display_date = formatInTimeZone(timestampIST, timezone, formatStr);
        const display_time = formatInTimeZone(timestampIST, timezone, 'HH:mm');

        return {
            display_date,
            display_time,
            display_timezone: timezone
        };
    }

    /**
     * Validate if a format is supported.
     * @param {string} format 
     * @returns {boolean}
     */
    static validateFormat(format) {
        return this.ALLOWED_FORMATS.includes(format);
    }
}

module.exports = DateFormatterService;
