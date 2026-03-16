const DEFAULT_DATE_FORMAT = 'DD-MM-YYYY';

const toDateParts = (date, timezone = 'Asia/Kolkata') => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const day = parts.find((part) => part.type === 'day')?.value || '';
    const month = parts.find((part) => part.type === 'month')?.value || '';
    const year = parts.find((part) => part.type === 'year')?.value || '';
    return { day, month, year };
};

export const parsePortalDateInput = (rawValue, format = DEFAULT_DATE_FORMAT) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    const normalized = raw.replace(/\//g, '-');
    const parts = normalized.split('-').map((part) => part.trim());
    if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
        return null;
    }

    let day;
    let month;
    let year;
    if (String(format || DEFAULT_DATE_FORMAT).startsWith('YYYY')) {
        [year, month, day] = parts;
    } else if (String(format || DEFAULT_DATE_FORMAT).startsWith('MM')) {
        [month, day, year] = parts;
    } else {
        [day, month, year] = parts;
    }

    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const candidate = `${year}-${paddedMonth}-${paddedDay}`;
    const date = new Date(`${candidate}T00:00:00+05:30`);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getUTCFullYear() !== Number(year) || String(date.getUTCMonth() + 1).padStart(2, '0') !== paddedMonth || String(date.getUTCDate()).padStart(2, '0') !== paddedDay) {
        return null;
    }
    return candidate;
};

export const formatPortalDate = (value, format = DEFAULT_DATE_FORMAT, timezone = 'Asia/Kolkata') => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        date = new Date(`${raw}T00:00:00+05:30`);
    } else {
        date = new Date(raw);
    }
    if (Number.isNaN(date.getTime())) return raw;

    const { day, month, year } = toDateParts(date, timezone);
    const delimiter = format.includes('/') ? '/' : '-';
    if (format.startsWith('YYYY')) return `${year}${delimiter}${month}${delimiter}${day}`;
    if (format.startsWith('MM')) return `${month}${delimiter}${day}${delimiter}${year}`;
    return `${day}${delimiter}${month}${delimiter}${year}`;
};

export const formatPortalDateTime = ({
    value,
    timezone = 'Asia/Kolkata',
    dateFormat = DEFAULT_DATE_FORMAT,
    timeFormat = '12h',
}) => {
    const raw = String(value || '').trim();
    if (!raw) return { date: '', time: '', value: '' };

    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T00:00:00+05:30`)
        : new Date(raw);
    if (Number.isNaN(date.getTime())) {
        return { date: raw, time: '', value: raw };
    }

    const formattedDate = formatPortalDate(raw, dateFormat, timezone);
    const formattedTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: timeFormat === '12h',
    }).format(date);

    return {
        date: formattedDate,
        time: formattedTime,
        value: `${formattedDate} ${formattedTime}`.trim(),
    };
};

