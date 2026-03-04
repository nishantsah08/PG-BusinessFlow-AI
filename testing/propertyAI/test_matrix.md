# PropertyAI Test Matrix

| Test Name | Category | Preconditions | Action | Expected Result | Invariant | Risk |
|-----------|----------|---------------|--------|-----------------|-----------|------|
| **Deposit Standard** | Domain | Rent: 12000, Date: 2024-01-02 | Calculate Deposit | 2500 | INV-DF-01 | High |
| **Deposit Dynamic** | Domain | Rent: 6000, Date: 2024-01-07 | Calculate Deposit | 2500 + 1000 = 3500 | INV-DF-02 | High |
| **Status Flow** | Domain | Unit AVAILABLE | Update -> BOOKED | Success | INV-BS-03 | Med |
| **Status Invalid** | Domain | Unit BOOKED | Update -> AVAILABLE | Fail (Throw Error) | INV-BS-05 | Med |
| **Double Book** | Domain | Unit BOOKED | Update -> BOOKED | Fail | INV-BS-01 | High |
| **Unit Amenity** | Domain | Prop: [WiFi], Unit: [AC] | Create Unit | Fail (Subset violation) | INV-AM-02 | Low |
| **Unique Prop** | Domain | Prop "A" exists | Create Prop "A" | Fail | INV-DI-01 | Med |
| **Soft Delete** | Lifecycle | Unit has history | Delete Unit | Status -> DELETED | INV-LD-01 | Med |
| **Hard Delete** | Lifecycle | Unit fresh | Delete Unit | Removed from array | INV-LD-03 | Low |
| **Meter Dup Link** | Domain | Unit linked to Meter A | Link to Meter B | Fail (already linked) | INV-DI-05 | Med |
