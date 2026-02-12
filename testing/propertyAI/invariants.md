# PropertyAI Invariants

## Core Invariants

### 1. Booking & Status
- **INV-BS-01**: A unit cannot have two active bookings.
- **INV-BS-02**: Tenant ID is mandatory when status is BOOKED.
- **INV-BS-03**: Valid transitions are strictly: AVAILABLE → BOOKED → NOTICE → AVAILABLE or NOTICE → BOOKED.
- **INV-BS-04**: Direct transition from AVAILABLE → NOTICE is forbidden.
- **INV-BS-05**: Direct transition from BOOKED → AVAILABLE is forbidden (must go through NOTICE or Admin Hard Reset).

### 2. Logical Delete
- **INV-LD-01**: Properties/Units with active history (bookings/meters) must be SOFT DELETED.
- **INV-LD-02**: Soft-deleted entities must be excluded from standard `get_` queries.
- **INV-LD-03**: Entities with NO history/links must be HARD DELETED (db removal).

### 3. Amenities
- **INV-AM-01**: Unit amenities must be a strict subset of Property amenities.
- **INV-AM-02**: A unit cannot introduce an amenity that does not exist on the Property.

### 4. Data Integrity
- **INV-DI-01**: Property Name must be unique system-wide.
- **INV-DI-02**: Unit Number must be unique within a Property.
- **INV-DI-03**: Meter Consumer Number must be unique system-wide.
- **INV-DI-04**: Meter cannot be linked to a non-existent Unit.
- **INV-DI-05**: A unit can only be linked to one meter (Meter→Units is 1:M, Unit→Meter is 1:1).

### 5. Deposit Financials
- **INV-DF-01**: 1st-5th of month start date = Standard Deposit (Base).
- **INV-DF-02**: 6th-10th of month start date = Standard + Dynamic (Daily Rent * 5, rounded to nearest 50).
- **INV-DF-03**: 11th onwards = Standard (or as per rate card, currently defaults to Standard in code).

### 6. Tenancy
- **INV-TN-01**: A unit cannot have an active tenant if its status is AVAILABLE.
- **INV-TN-02**: Assigning a tenant must transition status to BOOKED.
- **INV-TN-03**: Vacating a tenant with future date sets status to NOTICE.
- **INV-TN-04**: Vacating a tenant with past/today date sets status to AVAILABLE and clears tenant_id.

### 7. Maintenance
- **INV-MN-01**: Maintenance ticket must be linked to a valid Property.
- **INV-MN-02**: Created ticket status must be OPEN.

## Implementation Status
- [x] INV-BS-01 to 05
- [x] INV-LD-01 to 03
- [x] INV-AM-01 to 02
- [x] INV-DI-01 to 05
- [x] INV-DF-01 to 03
