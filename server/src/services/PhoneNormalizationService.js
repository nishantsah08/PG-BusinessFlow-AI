const { parsePhoneNumberWithError } = require('libphonenumber-js');

class PhoneNormalizationService {
    /**
     * Normalizes any input phone number string into a strictly formatted E.164 string.
     * Uses libphonenumber-js to parse and validate.
     * 
     * @param {string} phoneInput - The raw phone number input (can contain spaces, dashes, etc.)
     * @param {string} defaultCountry - The ISO 3166-1 alpha-2 country code to assume if country code is missing (Default: IN)
     * @returns {string} The canonical E.164 formatted string (e.g., +919876543210)
     * @throws {Error} If the phone number is completely invalid or cannot be parsed
     */
    static normalizeToE164(phoneInput, defaultCountry = 'IN') {
        if (!phoneInput) {
            throw new Error('Phone input is required for normalization.');
        }

        try {
            // Parse and strictly validate the number
            const phoneNumber = parsePhoneNumberWithError(String(phoneInput), defaultCountry);

            if (!phoneNumber.isValid()) {
                throw new Error(`Invalid phone number format for input: ${phoneInput}`);
            }

            // Return strictly in E.164 format (+<country><national>)
            return phoneNumber.format('E.164');
        } catch (error) {
            // Re-throw with a clear error message that the agents can handle
            throw new Error(`Phone normalization failed: ${error.message}`);
        }
    }
}

module.exports = PhoneNormalizationService;
