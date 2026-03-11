# 📘 TIME & DATE GOVERNANCE SPEC

**Project:** PG-BusinessFlow.ai  
**Version:** v1.0  
**Authority:** Architecture Layer  

## 1️⃣ OBJECTIVE

- System must internally operate only in IST (UTC+05:30).
- Default display format = `DD-MM-YYYY`.
- Users may change:
    - Timezone
    - Date format
- These settings affect display only, never storage or logic.

## 2️⃣ NON-NEGOTIABLE RULES

### 2.1 Internal Time Standard
All internal timestamps must follow ISO-8601 + IST offset: `YYYY-MM-DDTHH:mm:ss+05:30`.
- **Example:** `2026-02-25T17:30:00+05:30`
- **Never store:** UTC, Browser time, Epoch-only values, Formatted strings.

### 2.2 Display Standard (Default)
Default format: `DD-MM-YYYY`.
- **Example:** `25-02-2026`

## 3️⃣ ARCHITECTURE MODEL

Core Engine, Database, Event Bus, Ledger, Logs, and Workflows must all use IST only.
Timezone conversion and formatting must occur only at the presentation boundary.

## 4️⃣ USER SETTINGS SCHEMA

Add to user profile:
```json
{
  "timezone": "Asia/Kolkata",
  "date_format": "DD-MM-YYYY"
}
```
**Allowed date formats:**
- `DD-MM-YYYY` (default)
- `MM-DD-YYYY`
- `YYYY-MM-DD`
- `DD/MM/YYYY`

If not set, fallback to `Asia/Kolkata` and `DD-MM-YYYY`.

## 5️⃣ CONVERSION PIPELINE

1. Stored Timestamp (IST)
2. Convert IST → User Timezone
3. Apply Date Format
4. Return to UI

**Never convert before storage.**

## 6️⃣ API RESPONSE CONTRACT

All APIs returning dates must include:
```json
{
  "timestamp_ist": "2026-02-25T17:30:00+05:30",
  "display_date": "25-02-2026",
  "display_time": "12:00",
  "display_timezone": "Europe/London"
}
```
**Sorting must use:** `timestamp_ist`. Never sort by display string.

## 7️⃣ SCHEDULING RULE

All workflows and cron jobs must run in IST.
- **Example:** Rent due → 1st of month 09:00 IST (even if user timezone is different).

## 8️⃣ DATABASE RULE

Store timestamps as ISO-8601 string with `+05:30`.
- **Never** Firestore native Timestamp (UTC).
- **Never** local formatted date.

## 9️⃣ LOGGING RULE

All logs must include `created_at_ist` and `processed_at_ist`.
Single timeline = IST.
This includes debug observability streams such as the WhatsApp simulator inbound/outbound thread records.

## 🔟 MANDATORY SERVICES

### TimeAuthorityService
- `nowIST()`
- `toUserTimezone(ist, tz)`
- `toIST(local, tz)`

### DateFormatterService
- `formatDate(timestamp_ist, timezone, format)`
- `validateFormat(format)`

**No agent should manually format dates.**

## 11️⃣ VALIDATION RULES

Reject any event or write operation if:
- Timestamp missing offset
- Offset not `+05:30`
- Format not ISO-8601

## 12️⃣ TESTING REQUIREMENTS

- Changing user format does NOT change stored timestamp.
- Sorting remains stable after format change.
- Cross-midnight workflow test.
- DST conversion test (Europe/US).
- Replay test with mixed user timezones.

## 13️⃣ CODE REVIEW REJECTION LIST

Reject if developer:
- Uses `Date.now()` without normalization.
- Stores formatted date or UTC.
- Sorts using formatted string.
- Converts before saving.
- Lets frontend control timestamp.

---
**FINAL SUMMARY:**  
"System operates in IST only. Users can view time in their own timezone. Default date format is DD-MM-YYYY. Date formatting and timezone conversion are presentation-layer concerns only. Storage, events, ledger, logs, workflows must always use ISO-8601 IST."
