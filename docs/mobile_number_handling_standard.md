# Global Mobile Number Handling Standard

## Objective
Create a system-wide, non-breakable mobile number standard so every agent, API, database, and microservice uses the same logic for storing, searching, comparing, and validating phone numbers.

## 1. Design Goal
- **Single canonical format** across system
- **Zero ambiguity** in search
- **No duplicate records** due to formatting
- **Deterministic behavior** across all agents
- **Scalable** to multi-country support

## 2. Canonical Standard (Mandatory)
All mobile numbers must be stored in **E.164 format**:
`+<countrycode><nationalnumber>`

**Example:**
- `+919876543210`
- `+14155552671`

**This is the only searchable format in the system.**

## 3. System Rule (Non-Negotiable)
All phone numbers must be normalized before:
- Storage
- Comparison
- Indexing
- API response validation

**No raw comparison allowed anywhere.**

## 4. Architecture Blueprint
```
INPUT (any format)
        ↓
Phone Normalization Service
        ↓
Validation (libphonenumber)
        ↓
Canonical E.164
        ↓
Database storage
        ↓
Indexed lookup
```

## 5. Implementation Requirements

### 5.1 Library
- Use Google's `libphonenumber` (or language-specific equivalent like `libphonenumber-js` in Node).
- **Do NOT** write custom regex parsers.

### 5.2 Database Schema Standard
Every table storing phone numbers must follow:
- `phone_e164      VARCHAR(16)   NOT NULL`
- `phone_country   VARCHAR(4)`
- `phone_national  VARCHAR(15)`
- `phone_hash      CHAR(64)      (optional SHA256)`

**Constraints:**
- `UNIQUE(phone_e164)`
- `INDEX(phone_e164)`

*Phone must be stored as string, never INT.*

## 6. Input Handling Rules
When number is received (Examples):
- `9876543210`
- `+91 98765 43210`
- `091-9876543210`
- `0091 9876543210`

**All must convert to:** `+919876543210`

**Steps:**
1. Strip spaces / symbols
2. Detect country (from prefix or default system country)
3. Validate length rules
4. Convert to E.164
5. Reject if invalid

## 7. Search Standard
All search endpoints must:
- `normalize(input)`
- `query(phone_e164)`

*No LIKE queries, No partial matching, No raw comparisons.*

## 8. API Contract Standard
All APIs that accept phone numbers must:
- Accept raw input
- Internally normalize
- Return canonical E.164 in responses
- Never expose unnormalized storage values.

## 9. Agent-to-Agent Communication Rule
When one agent sends a phone number to another:
- **Only** send E.164 format
- **Never** send display-formatted values
- **Never** send local-format numbers

## 10. Edge Case Handling
| Case | Required Handling |
| :--- | :--- |
| Leading zero national format | Normalize |
| Country code missing | Use system default |
| Invalid length | Reject |
| Number recycling | OTP verification required |
| Duplicate in different format | Prevent via `UNIQUE(phone_e164)` |

## 11. Compliance Rule
Any new feature that stores, searches, filters, compares, or deduplicates must use the centralized phone normalization service. No independent logic allowed.

## 12. Anti-Patterns (Must Reject in Code Review)
- Storing numbers without country code
- Using INT or BIGINT for storage
- Comparing raw input to DB
- Allowing duplicate phone numbers in different formats
- Hardcoding country assumptions

## 13. Future-Proofing
System must support:
- Multi-country numbers
- Format display by locale
