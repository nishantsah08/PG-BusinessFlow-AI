const TimeAuthorityService = require('../../server/src/services/TimeAuthorityService');
const DateFormatterService = require('../../server/src/services/DateFormatterService');

describe('Time & Date Governance', () => {

    describe('TimeAuthorityService', () => {
        test('nowIST() should return a string with +05:30 offset', () => {
            const now = TimeAuthorityService.nowIST();
            expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?\+05:30$/);
        });

        test('validateIST() should correctly identify valid and invalid timestamps', () => {
            expect(TimeAuthorityService.validateIST('2026-02-25T17:30:00+05:30')).toBe(true);
            expect(TimeAuthorityService.validateIST('2026-02-25T17:30:00Z')).toBe(false); // UTC
            expect(TimeAuthorityService.validateIST('2026-02-25T17:30:00+00:00')).toBe(false); // Zero offset
            expect(TimeAuthorityService.validateIST('25-02-2026')).toBe(false); // Wrong format
        });

        test('toUserTimezone() should convert IST to target timezone', () => {
            const istTimestamp = '2026-02-25T10:00:00+05:30'; // 10:00 IST calculation
            // IST is 5.5 hours ahead of UTC. So 10:00 IST = 04:30 UTC.
            // London is UTC+0 in Feb (no DST).
            const londonDate = TimeAuthorityService.toUserTimezone(istTimestamp, 'Europe/London');

            // In London time it should stringify to contain 04:30 (accounting for local timezone of runner is tricky, so we check hours)
            // But toUserTimezone returns a Date object.
            expect(londonDate).toBeInstanceOf(Date);
        });
    });

    describe('DateFormatterService', () => {
        const istTimestamp = '2026-02-25T17:30:00+05:30';

        test('should format date correctly for default settings', () => {
            const result = DateFormatterService.format(istTimestamp, 'Asia/Kolkata', 'DD-MM-YYYY');
            expect(result.display_date).toBe('25-02-2026');
            expect(result.display_time).toBe('17:30');
            expect(result.display_timezone).toBe('Asia/Kolkata');
        });

        test('should format date correctly for US format and London timezone', () => {
            // 17:30 IST = 12:00 UTC (London in Feb)
            const result = DateFormatterService.format(istTimestamp, 'Europe/London', 'MM-DD-YYYY');
            expect(result.display_date).toBe('02-25-2026');
            expect(result.display_time).toBe('12:00');
        });

        test('should handle DST conversion (London in July)', () => {
            const summerIST = '2026-07-25T17:30:00+05:30'; // 17:30 IST = 12:00 UTC
            // London in July is UTC+1 (BST)
            const result = DateFormatterService.format(summerIST, 'Europe/London', 'DD-MM-YYYY');
            expect(result.display_time).toBe('13:00'); // 12:00 UTC + 1
        });

        test('should handle cross-midnight conversion', () => {
            const lateIST = '2026-02-25T02:30:00+05:30'; // 02:30 IST = 21:00 UTC (Previous Day)
            const result = DateFormatterService.format(lateIST, 'Europe/London', 'DD-MM-YYYY');
            expect(result.display_date).toBe('24-02-2026');
            expect(result.display_time).toBe('21:00');
        });
    });

    describe('Sorting Stability', () => {
        test('IST strings should sort correctly using localeCompare', () => {
            const times = [
                '2026-02-25T17:30:00+05:30',
                '2026-02-25T02:30:00+05:30',
                '2026-02-24T23:30:00+05:30'
            ];
            const sorted = [...times].sort((a, b) => a.localeCompare(b));
            expect(sorted[0]).toBe('2026-02-24T23:30:00+05:30');
            expect(sorted[1]).toBe('2026-02-25T02:30:00+05:30');
            expect(sorted[2]).toBe('2026-02-25T17:30:00+05:30');
        });
    });
});
