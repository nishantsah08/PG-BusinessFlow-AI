# Implementation Plan - PG-BusinessFlow.ai (v3.7)

## Goal
Implement the complete Agent System (v3.7) with a **Dynamic Workflow Engine**, aligned with Agent Definitions v2.5. Initially use **Dummy Data** for verification.

> [!IMPORTANT]
> **Phase 1: Dummy Data & Local Simulation**
> For the first step, **DO NOT** connect to Firestore or Google Cloud Storage.
> *   **Data Persistence**: Use local JSON files or in-memory dictionaries to simulate database operations.
> *   **File Storage**: Use a local directory (e.g., `./all_files`) to stand in for the GCS bucket. Agents should generate and store files here (simulating the single Application-Level Bucket).
> *   **Authentication**: Mock authentication where necessary.
> *   **Objective**: Verify the logic, tool interactions, and data schemas of all agents locally before cloud integration.

---

## 1. System-Wide Rules (Implementation)
*   **Application Name**: `PG-BusinessFlow.ai`
*   **Time**: All timestamps must be in **IST (Indian Standard Time)**.
*   **Immutability**: Finance (Ledger) and Artifacts (GCS) are append-only.
*   **Interaction**: All cross-agent communication MUST go through **MasterAI**.
*   **Data Structure**: Agents rely on structured data (JSON/Firestore) and reference Artifacts via Links.

---

## 2. Master AI (Orchestrator)
**Persona**: Kalyani (Head of Operations & Sales)
**Role**: Dynamic Workflow Engine & Orchestrator. Rewrite policies/workflows on the fly. Maintains **Conversation Memory**.

### Tools
*   **`add_workflow`**
    *   *Purpose*: Create or update dynamic workflows.
    *   *Inputs*: `trigger_event`, `steps` (List of tool calls/logic).
*   **`trigger_workflow`**
    *   *Purpose*: Execute a specific workflow based on an event.
    *   *Inputs*: `event_type`, `payload`.
*   **`get_execution_logs`**
    *   *Purpose*: Retrieve logs of past workflow executions for debugging.

### Universal Messaging & Memory Architecture
*   **Scope**: Applies to ALL incoming communication (WhatsApp, Email, SMS, Portal Chat).
*   **Session Management**:
    *   **Start Time**: Every session MUST have a `session_start_time` (IST).
    *   **Timeout**: 15 Minutes. If no interaction > 15 mins, flushed to CRM.
*   **Workflow Tracking**:
    *   **Execution**: Every workflow execution has a unique ID and `start_time`.
    *   **Storage (Final Phase)**: Full execution logs (steps, inputs, outputs) are stored in **GCP Bucket**.
    *   **CRM Link**: The CRM only stores the `workflow_id`, `status`, `summary`, and a **Link** to the GCP log.
*   **Incoming Message Logic**:
    1.  **Identify & Enrich**:
        *   Check if Lead exists in CRM.
        *   **If Exists**: Pull **ALL** data (Profile + Past History) into MasterAI context for "Rich Conversation".
        *   **If New**: Create new Lead Profile immediately.
    2.  **Link**: Update Lead's `chat_session_link` to point to the current active memory.
    3.  **Buffer**: Append message to the In-Memory Session.

### Pre-defined Workflows (To be implemented)
1.  **Bill Calculation**: 
    *   *Trigger*: Monthly (End of Month).
    *   *Steps*: Fetch Active Tenants -> Calculate Itemised Bill (Rent + Utility + Fines) -> Send via WhatsApp.
2.  **Payment Acknowledgement**: 
    *   *Trigger*: `payment_received` event.
    *   *Steps*: Verify Transaction -> Send "Thank You" message via WhatsApp.

---

## 3. Property AI (Assets)
**Role**: Inventory & Asset Manager.
**Logic**: Double Booking Prevention, Logical Deletes (Soft Delete if history exists).

### Tools
*   **`add_property`**
    *   *Inputs*: 
        *   `name`, `address`
        *   `description` (Text description of the property)
        *   `image_urls` (List of strings/URLs to property images)
        *   `amenities` (List), `floors`
*   **`add_unit`**
    *   *Inputs*: `property_id`, `unit_number`, `floor`, `amenities` (inherit from Property + override).
*   **`add_meter`**
    *   *Inputs*: 
        *   `meter_name`
        *   `consumer_number` (Unique utility consumer ID)
        *   `linked_units` (List of Unit IDs)
*   **`update_meter_reading`**
    *   *Inputs*: `meter_id`, `reading`, `date`.
*   **`calculate_deposit`**
    *   *Logic*:
        *   **1st-5th**: Standard Deposit (`2500`).
        *   **6th-10th**: Standard + Dynamic Calculation (`Daily_Rent * 5` rounded to nearest 50).
    *   *Inputs*: `monthly_rent`, `start_date`.
*   **`get_public_rate_card`**
    *   *Returns*: Full Rate Card Object (MRP, Deposit Rules, Fine Structure).
*   **`get_amenities`**
    *   *Inputs*: `property_id` (Mandatory). Returns facilities list (Property level).

---

## 4. CRM Agent (Sales & Retention)
**Role**: Lead & Tenant Relationship Manager.
**Strategy**: 3-Bucket Lifecycle (`Enquiry` -> `Visited` -> `Onboarded`).
**Persistence**: Lead Snapshot (Update on every interaction).

### Timeline & History Policy
*   **Time-Sorted View**: The CRM presents a unified timeline of Events.
    *   **Constraint**: All entries (Sessions, Workflows, Status Changes) must be presented in a **Time-Sorted** manner.
    *   **Data Structure**: All CRM History items must inherit a base interface with `{ timestamp: ISO_String, type: 'SESSION'|'WORKFLOW'|'ACTION' }`.
*   **Logging Rules**:
    *   **Real-time**: Do NOT log individual messages (WhatsApp/Email) as separate items.
    *   **Workflows**: Log specific "Workflow Execution" events (e.g., "Site Visit Scheduled") immediately.
    *   **Sessions**: Log the **Entire Conversation Session** only after the 15-minute timeout (Session End).

### Logic & Merging Rules
*   **Implicit Referral (Direct Visit)**: If status is `Visited` without `Enquiry` -> Search recent enquiry -> Merge original into new -> Add original phone to `phones.others`.
*   **Existing Customer Verification**: If caller claims to be existing customer (by name) -> Trust & Update primary profile.

### Tools
*   **`add_lead`**
    *   *Inputs*: `name`, `primary_phone`, `source` (WhatsApp/Call).
    *   *Logic*: Auto-resolve identity. Check "Existing Customer" rule. Initialize in `Enquiry` bucket.
*   **`log_interaction`**
    *   *Inputs*: `lead_id`, `interaction_type` (Call/Visit/Msg), `summary`, `sentiment`, `audio_file` (Path), `transcript_file` (Path).
    *   *Action*: 
        1.  **Retrieve Assets**: Audio/Transcript.
        2.  **Generate Metadata**: Summary, Sentiment, Tone.
        3.  **Identity Checks**: Trigger "Implicit Referral" logic if `Visited` detected without enquiry.
        4.  **Append**: Update Snapshot.
*   **`move_lead_bucket`**
    *   *Inputs*: `lead_id`, `target_bucket` (Enquiry/Visited/Onboarded), `strategy_override`.
*   **`get_leads_by_bucket`**
    *   *Purpose*: Filter leads for the Strategy Panel UI.
*   **`get_lead_details`**
    *   *Inputs*: `lead_id`. Returns full profile including preferences and history.

---

## 5. Human Resources Agent (Staff)
**Role**: Staff Manager.
**Responsibility**: Hiring, Firing, Compensation Definition (Salary Card).

### Tools
*   **`hire_staff`**
    *   *Inputs*: `name`, `designation`, `contact`, `base_salary`.
*   **`create_salary_card`**
    *   *Inputs*:
        *   `staff_id`
        *   `base_salary`
        *   `components`: `salary_advance_limit`, `reimbursements_allowed`, `incentives` (logic & amount_per_unit), `allowances` (travel, phone).
    *   *Action*: Store agreement and notify Finance Agent (Handover).
*   **`terminate_staff`**
    *   *Inputs*: `staff_id`, `reason`.

---

## 6. Finance AI (CFO)
**Role**: Guardian of the Ledger.
**Sub-Agents**: Billing, Accounting, Salary.
**Logic**: Strict Schema, Append-Only.

### Tools
*   **`record_incoming_txn`** (Generic & Split)
    *   *Inputs*: `txn_id`, `amount`, `payer_id`, `mode`, `date`, `attachment_path`.
    *   *Logic*: **Waterfall Allocation Strategy**. Automatically allocate 'amount' to ledger buckets in this priority:
        1.  **Security Deposit**
        2.  **Past Dues** (Arrears)
        3.  **Police Verification Fee**
        4.  **Rent**
        5.  **Parking Fee**
        6.  **Wi-Fi Fee**
        7.  **Electricity Bill**
        8.  **Asset Damage Recovery**
        9.  **Late Payment Fees**
    *   *Output*: Returns allocation breakdown.
*   **`record_outgoing_txn`**
    *   *Inputs*: `category` (OpEx/CapEx), `sub_category`, `work_done`, `property_id`, `amount`, `payee`, `approved_by`, `remarks`.
*   **`generate_monthly_bills`** (Billing Agent)
    *   *Trigger*: Monthly.
    *   *Logic*:
        *   **Rent**: Pre-paid (Next Month). Pro-rata support.
        *   **Utilities (Electricity)**: Post-paid (Last Month's usage * Rate).
        *   **Fines**: Late payment check.
        *   **Output**: Generates "Statement" sorted by Payment Allocation Priority.
*   **`process_salary`** (Salary Agent)
    *   *Inputs*: `staff_id`, `month`.
    *   *Logic*: Fetch Salary Card from HR -> Calculate Payout (Base + Incentives - Advances).
*   **`get_ledger`** (Accounting Agent)
    *   *Inputs*: `payer_id` or `staff_id`.
    *   *Returns*: Balance sheet (`Previous_Due + New_Bill - Payments`).

---

## 7. Communications AI (Gateway)
**Role**: Messaging Gateway (WhatsApp/Email) & Telephony (SIP Trunk).
**Logic**: Formatting & Tone Adaptation.

### Tools
*   **`send_message`**
    *   *Inputs*: `channel` (WhatsApp/Email), `recipient`, `content`, `tone` (Transactional/Marketing/Formal).
    *   *Logic*:
        *   If `tone` == 'Formal': Add signature.
        *   If `tone` == 'Casual': Add simulated emojis.
*   **`update_api_config`**
    *   *Purpose*: Update/Rotate API keys securely without redeploying.
*   **`process_voice_interaction`** (SIP Trunk Sub-Agent)
    *   *Inputs*: `audio_stream` or `recording_url`.
    *   *Output*: Generates **Audio Recording** and **Transcript** (passed to MasterAI -> CRM).
*   **`relay_event`** (Internal)
    *   *Purpose*: Forward incoming messages to MasterAI for processing.
    *   *Mechanism*: 
        *   **Ingestion Only**: Pushes event to MasterAI Context.
        *   **Autonomous Action**: MasterAI decides *if* and *when* to call `CRMAgent.log_interaction` or `CommunicationsAI.send_message`. No hardcoded scripts.

---

## Verification Strategy (Phase 1)

### Manual Verification Checklist
1.  **Setup**:
    *   Ensure `data/` and `all_files/` local directories exist.
    *   Start Agents locally.

2.  **Property & Rates**:
    *   Call `PropertyAI.get_public_rate_card`. Verify MRP and Deposit Rules.
    *   **Test Deposit**: Calculate deposit for start date 2nd (Standard) vs 7th (Dynamic). Verify values.
    *   **Test Property Creation**: Call `add_property` with description and image URLs.
    *   **Test Meter**: Call `add_meter` with consumer number.
    *   Create a Unit. Try to "double book" (simulated). Verify rejection.

3.  **CRM Flow & Merging**:
    *   **Scenario A (Standard)**: Call `add_lead("John Doe")`. Verify `Enquiry` bucket.
    *   **Scenario B (Implicit Referral)**: 
        *   Create `Enquiry` lead (Lead A).
        *   Simulate `Visited` status for a new number (Lead B) who mentions context of Lead A.
        *   Verify `CRM` merges Lead A -> Lead B and links phone numbers.
    *   **Scenario C (Snapshot)**: Call `log_interaction` with dummy audio. Verify snapshot contains metadata and transcript link.

4.  **HR & Finance Handshake**:
    *   Call `HR.create_salary_card` with specific incentives.
    *   Call `Finance.process_salary`. Verify calculation matches HR's rules.

5.  **Finance Waterfall Logic**:
    *   Simulate Ledger Dues: Security (₹2500) + Rent (₹12000).
    *   Call `Finance.record_incoming_txn(amount=3000)`.
    *   **Expect Allocation**: Security (₹2500) - Paid Full. Rent (₹500) - Partial.
    *   **Verify Ledger**: Security bucket CLOSED. Rent bucket PARTIALLY_PAID.

6.  **Master AI Workflow**:
    *   Mock a "Payment Received" event.
    *   Verify `MasterAI` triggers `Payment Acknowledgement` workflow -> Calls `CommunicationsAI` -> Logs "Message Sent".
