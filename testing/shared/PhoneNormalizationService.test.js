const PhoneNormalizationService = require('../../server/src/services/PhoneNormalizationService');

describe('PhoneNormalizationService', () => {
    it('should format a clean 10-digit Indian number into E.164', () => {
        expect(PhoneNormalizationService.normalizeToE164('9876543210')).toBe('+919876543210');
    });

    it('should format a number with spaces and a local 0 prefix', () => {
        expect(PhoneNormalizationService.normalizeToE164('098765 43210')).toBe('+919876543210');
    });

    it('should format a number with an explicit +91 country code', () => {
        expect(PhoneNormalizationService.normalizeToE164('+91 99999 88888')).toBe('+919999988888');
    });

    it('should format a US number if country code is provided in input', () => {
        // Even if default is IN, an explicit +1 should be parsed as US
        expect(PhoneNormalizationService.normalizeToE164('+1 415 555 2671')).toBe('+14155552671');
    });

    it('should format a US number if default country is changed to US', () => {
        expect(PhoneNormalizationService.normalizeToE164('4155552671', 'US')).toBe('+14155552671');
    });

    it('should throw an error for completely invalid strings', () => {
        expect(() => {
            PhoneNormalizationService.normalizeToE164('abc');
        }).toThrow();
    });

    it('should throw an error for numbers that are too short to be valid', () => {
        expect(() => {
            PhoneNormalizationService.normalizeToE164('98765');
        }).toThrow();
    });

    it('should throw an error for empty input', () => {
        expect(() => {
            PhoneNormalizationService.normalizeToE164('');
        }).toThrow();
    });
});
