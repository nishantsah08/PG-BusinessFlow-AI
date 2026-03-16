import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { formatPortalDate, parsePortalDateInput } from '../../lib/dateDisplay';

const DateInputField = ({
    value,
    onValueChange,
    ariaLabel,
    className = '',
    buttonClassName = '',
    placeholder,
    disabled = false,
    min,
    max,
    name,
}) => {
    const { settings } = useSettings();
    const dateFormat = settings?.date_format || 'DD-MM-YYYY';
    const hiddenInputRef = useRef(null);
    const [draft, setDraft] = useState('');

    const displayValue = useMemo(
        () => (value ? formatPortalDate(value, dateFormat, settings?.timezone || settings?.timeZone || 'Asia/Kolkata') : ''),
        [dateFormat, settings?.timeZone, settings?.timezone, value]
    );

    useEffect(() => {
        setDraft(displayValue);
    }, [displayValue]);

    const commitValue = (raw) => {
        const parsed = parsePortalDateInput(raw, dateFormat);
        if (parsed === null) {
            setDraft(displayValue);
            return;
        }
        onValueChange(parsed);
        setDraft(parsed ? formatPortalDate(parsed, dateFormat, settings?.timezone || settings?.timeZone || 'Asia/Kolkata') : '');
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="text"
                aria-label={ariaLabel}
                name={name}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={(event) => commitValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        commitValue(event.currentTarget.value);
                    }
                }}
                placeholder={placeholder || dateFormat}
                disabled={disabled}
                className={className}
                inputMode="numeric"
            />
            <button
                type="button"
                aria-label="Open calendar picker"
                title={`Open calendar for ${ariaLabel}`}
                onClick={() => hiddenInputRef.current?.showPicker?.()}
                disabled={disabled}
                className={buttonClassName || 'rounded-xl border border-slate-200 bg-white p-3 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'}
            >
                <CalendarDays className="h-4 w-4" />
            </button>
            <input
                ref={hiddenInputRef}
                type="date"
                value={value || ''}
                onChange={(event) => commitValue(event.target.value)}
                min={min}
                max={max}
                className="sr-only"
                tabIndex={-1}
            />
        </div>
    );
};

export default DateInputField;
