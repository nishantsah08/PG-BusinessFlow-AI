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
**Status Transitions**: `AVAILABLE` → `BOOKED` → `NOTICE` → `AVAILABLE`. Also allows `NOTICE` → `BOOKED` (Rebooking). All other transitions are invalid and must be rejected.

### Tools
*   **`add_property`**
    *   *Inputs*: `name` (Unique), `address`, `description`, `image_urls`, `amenities` (List), `floors`.
    *   *Output*: `property_id` (System Generated - Unique).
*   **`update_property`**
    *   *Inputs*: `property_id` (Target - Immutable), `name` (Unique), `address`, `description`, `image_urls`, `amenities`, `floors`.
*   **`get_properties`**
    *   *Inputs*: `property_id` (Optional).
*   **`delete_property`**
    *   *Inputs*: `property_id`. (Soft delete if history exists).
*   **`add_unit`**
    *   *Inputs*: `property_id`, `unit_number` (Unique within Property), `floor`, `types` (List of Strings, e.g., ["Double Sharing", "Bunk Bed"]), `amenities` (Default: Inherit from Property).
    *   *Output*: `unit_id` (System Generated - Unique).
*   **`update_unit`**
    *   *Inputs*: `unit_id`, `unit_number`, `floor`, `types`, `amenities`, `status`.
*   **`get_units`**
    *   *Inputs*: `property_id` (Optional), `unit_id` (Optional), `floor` (Optional), `types` (List - Filter), `status` (Optional).
*   **`delete_unit`**
    *   *Inputs*: `unit_id`.
*   **`assign_tenant`**
    *   *Inputs*: `unit_id`, `lead_id` (Tenant), `start_date`, `monthly_rent`, `security_deposit`.
    *   *Logic*: Links a person to a prompt. validates `lead_id` exists in CRM.
*   **`vacate_tenant`**
    *   *Inputs*: `unit_id`, `end_date`.
    *   *Logic*: Marks unit as `NOTICE` or `AVAILABLE` depending on date.
*   **`add_meter`**
    *   *Inputs*: `meter_name`, `consumer_number`, `type`, `linked_units`.
    *   *Constraint*: **Meter→Units is 1:M**.
*   **`get_meters`**
    *   *Inputs*: `meter_id` (Optional).
*   **`delete_meter`**
    *   *Inputs*: `meter_id`.
*   **`update_meter_reading`**
    *   *Inputs*: `meter_id`, `reading`, `date`, `image_url`.
*   **`delete_meter_reading`**
    *   *Inputs*: `meter_id`.
*   **`log_maintenance_req`**
    *   *Inputs*: `property_id`, `unit_id` (Optional), `category` (Plumbing/Electrical/etc), `description`, `priority` (Low/Medium/High/Critical), `reported_by` (Lead ID or Staff ID).
    *   *Output*: `ticket_id`.
*   **`update_maintenance_req`**
    *   *Inputs*: `ticket_id`, `status` (Open/In Progress/Resolved), `remarks`, `cost` (if applicable).
*   **`get_maintenance_reqs`**
    *   *Inputs*: `property_id`, `unit_id`, `status`.
*   **`get_public_rate_card`**
    *   *Returns*: Full Rate Card Object.
*   **`calculate_deposit`**
    *   *Inputs*: `monthly_rent`, `start_date`.
*   **`get_amenities`**
    *   *Inputs*: `property_id` (Mandatory).

---

## 4. CRM Agent (Sales & Retention)
**Role**: Lead & Tenant Relationship Manager.
**Description**: The memory of every human interaction. From the first "Hello" (Lead) to the last goodbye (Tenant), you record their story — every call, visit, complaint, and preference — as an append-only chronological log. You never manage the Property they stay in, only their experience of it. Nothing is overwritten; every interaction is a new entry, so one can always trace exactly how things progressed over time.
**Inputs**: WhatsApp, Phone Calls, Emails (all routed via MasterAI).
**Core Principle**: Append-only. The CRM is an event log, not a mutable table. Every interaction is a new timestamped record — never an update to an existing one. Corrections are new entries referencing the original.

---

### 4.1 User Profile Snapshot (The Person)
The User Profile Snapshot is the **profile of a human and their requirement**. It captures who they are and what they are looking for, not what happened to them (that's the timeline's job).

**Identity Rule**: The **lead_id IS the 10-digit primary mobile number** (e.g., `9800098000`). The CRM is about humans, and a human is identified by their phone. Additional numbers are stored in `phones.others`, but the primary number is the permanent key.

```json
{
  "lead_id": "9800098000",
  "name": "Ankit Verma",
  "email": "ankit.verma@example.com",
  "source": {
    "category": "Google Business Listing",
    "detail": null
  },
  "requirement_date": "2024-03-01",
  "phones": {
    "primary": { "number": "9800098000", "whatsapp": true },
    "others": [
      { "number": "7900079000", "whatsapp": false }
    ]
  },
  "demographics": {
    "type": "Student",
    "gender": "Male",
    "company_name": null,
    "college": "IIT Delhi"
  },
  "preferences": ["North Facing", "Vegetarian", "No Smoking"],
  "unit_type_required": "Single Room",
  "ai_notes": {
    "budget_sensitivity": "Price-conscious, compared rates with nearby PGs",
    "move_in_urgency": "High — semester starts 1st March",
    "personality": "Polite, asks detailed questions, decision-maker"
  },
  "status": "Enquiry",
  "created_at": "2024-02-15T10:30:00+05:30"
}
```
> **`lead_id` = `phones.primary.number`**: There is no separate generated ID. The person's 10-digit phone number IS their identity in the system. If Ankit's number is `9800098000`, his `lead_id` is `9800098000`.
>
> **`phones.whatsapp`**: Each phone number tracks whether it has WhatsApp. If the primary number doesn't have WhatsApp, the system checks `others` for a WhatsApp-enabled number to use as the messaging channel.
>
> **`source`** (Structured): How the lead discovered the business. Has two parts:
> - `category` (Broad): `Website`, `Google Business Listing`, `WhatsApp`, `Reference`, `Walk-in`, `Social Media`, `Just Dial`, `Other`. The AI can dynamically add new broad categories as needed.
> - `detail` (Specific, optional): Further detail within the category. E.g., if `category` is `Social Media`, `detail` could be `YouTube`, `Facebook`, `Instagram`. If `category` is `Reference`, `detail` could be the referrer's name. `null` if no further detail is available.
>
> **`ai_notes`** (Dynamic): A free-form object where the CRM AI **autonomously** adds observations it extracts from conversations that help build a richer profile. Keys are invented by the AI on the fly — there is no fixed schema. Examples: `budget_sensitivity`, `move_in_urgency`, `personality`, `family_situation`, `negotiation_style`. Updated during the Snapshot Process whenever new insights surface.
>
> **`unit_type_required`**: What type of accommodation the lead is looking for. E.g., `Single Room`, `Double Sharing`, `Triple Sharing`, `1BHK`, `2BHK`. Updated during Snapshot Process if the lead changes their requirement.
>
> **`status` is a convenience field**: The "real" status lives in the timeline as `STATUS_CHANGE` events (e.g., Enquiry→Visited on Feb 20, Visited→Onboarded on Mar 5). The `status` field on the snapshot is just a shortcut so you don't have to scan the entire timeline every time. It is always kept in sync with the latest `STATUS_CHANGE` event.

---

### 4.2 Artifacts (Linked Files)
Artifacts are **immutable files** stored in GCS (or local `./all_files` in Phase 1) and referenced by link from timeline events. They are never deleted.

An interaction can have **zero or many** artifacts of any type. Some types (Images, PDFs) commonly appear in **multiples** per interaction:

| Artifact Type | Multiplicity | Examples |
|---|---|---|
| Call Recording | 1 per call | `gcs://bucket/recordings/9800098000/2024-02-16.wav` |
| Transcript | 1 per call | `gcs://bucket/transcripts/9800098000/2024-02-16.txt` |
| Image | **Multiple** | `id-proof-front.jpg`, `id-proof-back.jpg`, `room-photo.jpg` |
| Document (PDF) | **Multiple** | `quotation.pdf`, `agreement-draft.pdf`, `police-verification.pdf` |
| Workflow Log | 1 per workflow | `gcs://bucket/workflows/WF-2024-0042.json` |

Artifacts are **always referenced via links** (as an array) within a Session or other timeline event — never embedded inline. Multiple files of the same type simply appear as multiple entries in the `links.artifacts` array.

---

### 4.3 Session (Conversation Record)
A Session is the record of a **single conversation** — sent to the CRM by **MasterAI** after the 15-minute inactivity timeout. The CRM does not create sessions; it **receives** them from MasterAI as part of the Snapshot Process. Individual messages are NOT logged separately.

Each Session captures:
```json
{
  "event_id": "EVT-0002",
  "timestamp": "2024-02-16T14:00:00+05:30",
  "type": "SESSION",
  "interaction_type": "Call",
  "participants": [
    { "role": "MasterAI", "name": "Kalyani" },
    { "role": "Customer", "name": "Ankit Verma" },
    { "role": "Sales Manager", "name": "Jatin" }
  ],
  "summary": "Asked about 1BHK availability near campus. Interested in north-facing unit.",
  "sentiment": "Positive",
  "tone": "Curious",
  "financial_impact": "Potential rent ₹12,000/mo if converted.",
  "compliance_impact": null,
  "links": {
    "artifacts": [
      "gcs://bucket/recordings/9800098000/2024-02-16.wav",
      "gcs://bucket/transcripts/9800098000/2024-02-16.txt"
    ],
    "workflow_id": "WF-2024-0042",
    "related_event_ids": ["EVT-0003"]
  }
}
```

| Field | Purpose |
|---|---|
| `participants` | Array of everyone in the conversation. Each entry has `role` (`MasterAI`, `Customer`, `Caretaker`, `Sales Manager`, `Owner`, etc.) and `name`. Minimum 2 participants (MasterAI + Customer). Can be 3+ for multi-party interactions. |
| `summary` | AI-generated short summary of the conversation. |
| `sentiment` | `Positive` / `Neutral` / `Negative` — one-line description of the overall mood of the interaction. |
| `tone` | `Curious` / `Frustrated` / `Formal` / `Urgent` etc. — one-line description of how the person communicated, extracted from transcript. |
| `financial_impact` | One-line note on money implications, if any. E.g., "Potential rent ₹12,000/mo", "Deposit refund ₹2,500 due", "Late fee ₹50/day accumulating". `null` if no financial relevance. |
| `compliance_impact` | One-line note on regulatory/legal implications, if any. E.g., "Police verification pending", "Agreement unsigned past 7 days", "ID proof not submitted". `null` if no compliance relevance. |
| `links.artifacts` | Array of links to all files associated with this conversation (recordings, transcripts, images, PDFs). Can contain multiple entries. |
| `links.workflow_id` | If this conversation triggered a workflow (e.g., site visit scheduled), the workflow ID lives here. |
| `links.related_event_ids` | References to other timeline events **caused by** this session. E.g., if this call led to a status change (EVT-0003), it's listed here — connecting cause (the call) to effect (the status change). |

> Opening any Session gives you the **full picture** — the summary, the mood, financial/compliance flags, and links to every related file and action — without searching elsewhere.

**Snapshot Process** (Triggered by MasterAI after each single session):
1.  **Retrieve Assets**: Receive Audio Recording and Transcript (triggered by MasterAI workflow).
2.  **Generate Metadata**: Run models over the transcript → extract Summary, Sentiment, Tone, Financial Impact, Compliance Impact.
3.  **Enrich User Profile Snapshot**: If the conversation reveals new profile information (e.g., college name, email, preference, source of discovery) or new AI insights (e.g., budget sensitivity, urgency), update the User Profile Snapshot including `ai_notes`. This is the **only** place where the snapshot is modified — always as a side-effect of processing a conversation, never manually.
4.  **Identity Checks**: Trigger merge/verification logic if needed (see Identity Resolution below).
5.  **Append**: Store as a new `SESSION` event with all metadata and artifact links in the lead's timeline.

---

### 4.4 Status (Lifecycle)
The lead's lifecycle is tracked through **4 buckets**. Every transition is a dated, immutable `STATUS_CHANGE` event appended to the timeline.

```
The Lead Lifecycle is a strict State Machine. Transitions must follow this path:
1.  **Enquiry** (`New Lead`)
2.  **Visited** (`Site Visit Done`)
3.  **Onboarded** (`Tenant`)
4.  **Left** (`Ex-Tenant`)
5.  **Enquiry** (`Re-engaged`)

**Rules**:
*   Skips are NOT allowed (e.g., Cannot go Enquiry → Onboarded).
*   `lead.status` must always match the latest `STATUS_CHANGE` event.
*   `Archive` is a special state for soft deletion.
*   The cycle can **repeat** — a person who `Left` can start a new `Enquiry`, creating a new loop. All prior history is preserved.
*   Every transition records `from`, `to`, `reason`, and `changed_at` (IST).
*   The lead's `status` field on the snapshot is a convenience — always kept in sync with the latest `STATUS_CHANGE` event.

**Status Change Event**:
```json
{
  "event_id": "EVT-0003",
  "timestamp": "2024-02-20T11:00:00+05:30",
  "type": "STATUS_CHANGE",
  "from": "Enquiry",
  "to": "Visited",
  "reason": "Site visit completed",
  "changed_at": "2024-02-20T11:00:00+05:30"
}
```

---

### Identity Resolution & Merging Rules
*   **Implicit Referral (Direct Visit)**: If a lead's status is detected as `Visited` without a prior `Enquiry` record (Direct Walk-in), it implies a proxy enquiry.
    *   *Action*: Search for a recent enquiry matching the context.
    *   *Merge*: Merge the original enquiry lead INTO the new visiting lead.
    *   *Append*: A `MERGE` event is written to the timeline. The original lead's phone is added to `phones.others`. Relationship (e.g., "Friend", "Parent") is recorded if available.
*   **Existing Customer Verification**: If a caller claims to be an existing customer (identifies by name) and the name matches:
    *   *Action*: Trust the identity.
    *   *Append*: A `CORRECTION` event updating contact details (new number added to profile).

### Data Model (Firestore Collections — Phase 2)
| Collection | Document Key | Purpose |
|---|---|---|
| `leads` | `lead_id` (= primary phone, e.g., `9800098000`) | Lead Snapshot (profile, demographics, preferences). |
| `leads/{lead_id}/timeline` | `event_id` (auto-generated) | Append-only sub-collection. Sessions, Status Changes, Merges, Corrections. Never deleted. |

### 4.5 CRM Agent API Skills (Exhaustive)
The CRM Agent exposes a comprehensive set of tools to support both **Chat (MasterAI)** and **GUI (Admin Dashboard)** operations.

#### Core Lifecycle
*   **`add_lead`**: `name`, `primary_phone`, `email`, `source` (Object), `demographics`, `preferences`, `unit_type_required`, `requirement_date`, `notes`.
*   **`change_status`**: `lead_id`, `to_status`, `reason`.
*   **`merge_leads`**: `source_lead_id`, `target_lead_id`, `relationship` (e.g., "Spouse", "Duplicate").
*   **`archive_lead`**: `lead_id`, `reason` (Soft Delete).

#### Profile Management
*   **`update_lead_snapshot`**: `lead_id`, `demographics`, `preferences`, `email`, `source`, `ai_notes`.
*   **`add_secondary_phone`**: `lead_id`, `phone_number`, `label`.
*   **`set_primary_phone`**: `lead_id`, `phone_number`.

#### Timeline & Interaction
*   **`log_session`**: `lead_id`, `interaction_type`, `participants`, `summary`, `sentiment`, `tone`, `links` (artifacts/workflows).
*   **`add_manual_note`**: `lead_id`, `content`, `author` (for human agents).
*   **`get_timeline`**: `lead_id`, `limit`, `offset`, `type_filter` (SESSION/STATUS/NOTE).

#### Search & Retrieval (GUI Support)
*   **`get_lead_by_phone`**: `phone` (Strict lookup, checks primary & secondary).
*   **`search_leads`**: `query` (Partial name/email/phone), `limit`, `offset`.
*   **`get_leads_by_status`**: `status`, `limit`, `offset`.
*   **`get_recent_leads`**: `limit` (Sorted by last interaction).
*   **`get_dashboard_stats`**: Returns counts per status, leads created today, pending follow-ups.

#### Artifacts
*   **`link_artifact`**: `lead_id`, `file_url`, `file_type`, `description` (Manually attach file).
*   **`get_lead_artifacts`**: `lead_id`, `type_filter`.

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
