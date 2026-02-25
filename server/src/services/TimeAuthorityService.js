const { formatInTimeZone, toDate } = require('date-fns-tz');

/**
 * TimeAuthorityService
 * Authority: Architecture Layer
 * Objective: System must internally operate only in IST (UTC+05:30).
 */
class TimeAuthorityService {
    static IST_TIMEZONE = 'Asia/Kolkata';
    static ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";

    /**
     * Get current time in ISO-8601 + IST offset.
     * Example: 2026-02-25T17:30:00+05:30
     * @returns {string} ISO-8601 string with +05:30
     */
    static nowIST() {
        return formatInTimeZone(new Date(), this.IST_TIMEZONE, this.ISO_FORMAT);
    }

    /**
     * Convert IST timestamp to User Timezone.
     * @param {string} istTimestamp ISO-8601 IST string
     * @param {string} userTimezone Target timezone (e.g., 'Europe/London')
     * @returns {Date} Date object normalized to user timezone
     */
    static toUserTimezone(istTimestamp, userTimezone) {
        return toDate(istTimestamp, { timeZone: userTimezone });
    }

    /**
     * Convert local time in target timezone back to IST.
     * @param {Date|string} localTime
     * @param {string} userTimezone
     * @returns {string} ISO-8601 IST string
     */
    static toIST(localTime, userTimezone) {
        return formatInTimeZone(localTime, this.IST_TIMEZONE, this.ISO_FORMAT);
    }

    /**
     * Validates if a timestamp matches the mandated IST format.
     * @param {string} timestamp 
     * @returns {boolean}
     */
    static validateIST(timestamp) {
        if (!timestamp || typeof timestamp !== 'string') return false;
        // ISO-8601 regex with mandatory +05:30 offset, allowing optional milliseconds
        const istRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?\+05:30$/;
        return istRegex.test(timestamp);
    }
}

module.exports = TimeAuthorityService;
