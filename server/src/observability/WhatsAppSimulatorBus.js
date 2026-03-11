const PhoneNormalizationService = require('../services/PhoneNormalizationService');
const TimeAuthorityService = require('../services/TimeAuthorityService');

const MAX_EVENTS = 500;
const events = [];

function nowIso() {
    return TimeAuthorityService.nowIST();
}

function normalizePhone(phone) {
    try {
        return PhoneNormalizationService.normalizeToE164(phone);
    } catch (_err) {
        return String(phone || '').trim();
    }
}

function append(event) {
    events.push(event);
    if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
    }
}

function recordInbound(payload = {}) {
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;
    const from = normalizePhone(message.from || '');
    const body = message?.text?.body || '';
    const event = {
        id: `in_${message.id || Date.now()}`,
        direction: 'inbound',
        channel: 'whatsapp',
        phone: from,
        body,
        media: message.image || message.audio || message.document || null,
        raw: message,
        at: nowIso()
    };
    append(event);
    return event;
}

function recordOutbound(data = {}, adapterResult = {}) {
    const to = normalizePhone(data.to || '');
    const body = data?.text?.body || data?.template?.name || '[non-text message]';
    const event = {
        id: `out_${adapterResult?.data?.id || Date.now()}`,
        direction: 'outbound',
        channel: 'whatsapp',
        phone: to,
        body,
        media: data?.image || data?.audio || data?.document || null,
        raw: data,
        at: nowIso(),
        simulated: Boolean(adapterResult?.simulated)
    };
    append(event);
    return event;
}

function listByPhone(phone) {
    const normalized = normalizePhone(phone);
    return events.filter((e) => e.phone === normalized);
}

function clearByPhone(phone) {
    const normalized = normalizePhone(phone);
    for (let i = events.length - 1; i >= 0; i -= 1) {
        if (events[i].phone === normalized) {
            events.splice(i, 1);
        }
    }
}

module.exports = {
    recordInbound,
    recordOutbound,
    listByPhone,
    clearByPhone,
    normalizePhone
};
