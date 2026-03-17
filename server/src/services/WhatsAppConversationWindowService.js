const PhoneNormalizationService = require('./PhoneNormalizationService');
const TimeAuthorityService = require('./TimeAuthorityService');

const WINDOW_MS = 24 * 60 * 60 * 1000;
const lastInboundByPhone = new Map();

function normalizePhone(phone) {
    return PhoneNormalizationService.normalizeToE164(phone);
}

function normalizeTimestamp(input) {
    if (input === null || input === undefined || input === '') {
        return Date.now();
    }
    if (typeof input === 'number') {
        return input > 1_000_000_000_000 ? input : input * 1000;
    }
    const numeric = Number(input);
    if (Number.isFinite(numeric) && String(input).trim() !== '') {
        return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    }
    const parsed = new Date(input).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
}

function formatIst(ms) {
    return TimeAuthorityService.toIST(new Date(ms));
}

function recordInboundMessage(phone, timestamp) {
    const normalized = normalizePhone(phone);
    const lastInboundAtMs = normalizeTimestamp(timestamp);
    lastInboundByPhone.set(normalized, lastInboundAtMs);
    return getWindowStatus(normalized, lastInboundAtMs);
}

function getWindowStatus(phone, now = Date.now()) {
    const normalized = normalizePhone(phone);
    const nowMs = normalizeTimestamp(now);
    const lastInboundAtMs = lastInboundByPhone.get(normalized) || null;
    const expiresAtMs = lastInboundAtMs ? lastInboundAtMs + WINDOW_MS : null;
    const windowOpen = Boolean(lastInboundAtMs && expiresAtMs > nowMs);

    return {
        phone: normalized,
        window_open: windowOpen,
        last_inbound_at: lastInboundAtMs ? formatIst(lastInboundAtMs) : null,
        expires_at: expiresAtMs ? formatIst(expiresAtMs) : null,
        remaining_ms: windowOpen ? expiresAtMs - nowMs : 0
    };
}

function clearPhone(phone) {
    lastInboundByPhone.delete(normalizePhone(phone));
}

function clearAll() {
    lastInboundByPhone.clear();
}

module.exports = {
    WINDOW_MS,
    recordInboundMessage,
    getWindowStatus,
    clearPhone,
    clearAll
};
