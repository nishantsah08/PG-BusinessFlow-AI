# HR Agent Test Plan

## 1. Mission
Build a risk-proof testing stack for HRAgent that strictly enforces business invariants, data integrity, and correct integration with Finance. The goal is to ensure staff management logic is robust and error-free, prioritizing correctness over code coverage.

## 2. Scope
- **Lifecycle**: Hiring, Updating Profile, Termination.
- **Compensation**: Salary Card definition, updates, and retrieval.
- **Leaves**: Recording and approving leaves.
- **Incentives**: Calculation based on defined logic.
- **Integration**: Handshake with Finance Agent (via Salary Card).

## 3. Testing Layers
### Layer 1: Domain Tests (Logic & Invariants)
- **Goal**: Validate core business rules and invariants without external dependencies.
- **Coverage**:
    - Identity uniqueness.
    - Status transitions.
    - Compensation validation (non-negative).
    - Leave date logic (start <= end, no overlap).
    - Incentive formulas.

### Layer 2: Integration Tests (Workflows)
- **Goal**: Validate multi-step business flows.
- **Scenarios**:
    - **Hiring Flow**: Hire -> Create Salary Card -> Verify Active.
    - **Termination Flow**: Active -> Terminate -> Try to Record Leave (Fail).
    - **Update Flow**: Create Salary Card -> Update Components -> Verify History.

### Layer 3: Contract Tests (Finance Handover)
- **Goal**: Ensure data shapes match what Finance Agent expects.
- **Checks**:
    - Salary Card Schema matches Finance requirements.
    - Mandatory fields (Bank Details, Base Salary) are present.

### Layer 4: API Tests (Boundary & Error)
- **Goal**: Validate tool inputs and error handling.
- **Checks**:
    - Missing required fields.
    - Invalid data types.
    - Malformed dates.
    - Non-existent IDs.

## 4. Execution Strategy
- **Environment**: Local execution using Jest (or similar test runner available in the repo).
- **Data**: In-memory mock data (Phase 1).
- **Order**: Invariants -> Domain -> Integration -> Contract -> API -> Regression.

## 5. Risk Assessment
| Feature | Risk | Priority |
| :--- | :--- | :--- |
| Salary Calculation Logic | HIGH | P0 |
| Incentive Logic | HIGH | P0 |
| Termination State | HIGH | P0 |
| Finance Integration | HIGH | P0 |
| Leave Tracking | MEDIUM | P1 |
| Profile Updates | LOW | P2 |
| Retrieval Queries | LOW | P2 |
