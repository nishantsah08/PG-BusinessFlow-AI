# Agent Definitions (v2.5)

## 1. System-Wide Rules
*   **API-First**: Agents act via strictly defined APIs.
*   **Interaction Rule**: No agent interacts with each other, everyone talks to MasterAI only (unless they are sub-agents interacting with their super-agent).
*   **Accounting Immutability**: Append-Only Ledger.
*   **Artifacts**: All files (images, audio, docs) are stored in a single Application-Level Google Cloud Storage bucket. They are immutable (append-only, no delete/exclude). Agents only share links.
*   **Data**: Firestore stores structured data. Each agent has its own data source.
*   **Communication**: Event-based via MCP / PubSub.
*   **Deployment**: Independent Docker containers on Cloud Run.
*   **Time Zone**: Application uses IST (Indian Standard Time) system-wide.
*   **Application Name**: `PG-BusinessFlow.ai`
*   **Ingress Rule (Web + External Channels)**: All user-channel ingress must pass through **CommunicationsAI** normalization before orchestration by MasterAI.
*   **Active Web Chat Endpoint**: `POST /api/communications/chat`.
*   **Ops Readiness Endpoints**: `GET /health`, `GET /ready`.
*   **Runtime Policy Flags**: `APP_ENV`, `ALLOW_DEBUG_ENDPOINTS`, `GOOGLE_AUTH_MODE`.

---

## 2. Master AI (Orchestrator)
*   **Identity**: `MasterAI` (Persona: **Kalyani**)
*   **Role**: Head of Operations & Sales (Central Controller).
*   **Core Concept**:
    *   **Hub & Spoke Model**: The system consists of isolated, containerized agents (Finance, Property, CRM, HR). Master AI is the central brain.
    *   **Decomposition (The "Clean Architecture")**:
        *   **Brain**: `MasterAI` (Pure Business Logic).
        *   **Ears/Mouth**: `WebhookService` (Gateway for HTTP/Webhooks).
        *   **Nerves**: `EventBus` (Pub/Sub Infrastructure).
        *   **Memory**: `SessionService` (State Store).
    *   **Orchestration**: Master AI invokes the specific skill sets of agents to fulfill tasks.
*   **Execution Modes**:
    1.  **Direct Invocation**: Master AI directly calls an agent's skill using **Synchronous MCP**.
    2.  **Workflow Execution**: Master AI follows a structured "Business Process", triggered by one of three mechanisms:
        *   **Event-Triggered**: A matching system event fires (e.g., `payment.received`).
        *   **Timer-Triggered**: A scheduled timer fires at a configured interval.
        *   **MasterAI-Decided**: MasterAI reads the workflow `trigger_description` and `description` to decide to trigger it during or after a conversation based on the context.
*   **Communication Architecture (Hybrid - ADR-001)**:
    *   **Downstream (Control)**: Master AI -> Agents via **Synchronous MCP** (e.g., `await crm.add_lead()`).
    *   **Upstream (Report)**: Agents -> Master AI via **Asynchronous Events** (e.g., `invoice.generated`). Master AI subscribes to the Event Bus.
*   **Policies & Workflows**:
    *   **Strict Adherence**: Executed autonomously once approved.
    *   **Validation**: User validation required only at creation/update.
*   **Session Management & Persistence**:
    *   **Identity Source (Dual Lookup)**: MasterAI identifies users via **phone number OR email**:
        *   **Phone Number (`lead_id`) via CommunicationsAI**: Maps to a CRM profile via `get_lead_by_phone`. The user's `profile_type` determines guardrail behavior.
        *   **Email ID via Dashboard**: Maps to a CRM profile via `get_lead_by_email` (case-insensitive). If the email matches the CEO, full transparent access is granted.
    *   **Context Loading for Known Users**: When a CRM profile is found, MasterAI loads the **last 3 SESSION events** from the user's timeline. This gives Kalyani memory of recent conversations (summary, sentiment, tone) so she doesn't start from scratch.
    *   **Deferred Lead Creation for Unknown Users**: If no CRM profile is found:
        *   A **temporary in-memory context** is created (`isTemporary: true`). No CRM write occurs.
        *   The conversation proceeds normally with Kalyani.
        *   At session timeout (15-min inactivity), MasterAI uses the LLM to classify the full conversation:
            *   **Business-relevant** (room enquiry, rent, visits, complaints, payments) → CRM lead is created + session logged with AI-generated summary/sentiment/name.
            *   **Not relevant** (wrong number, spam, unrelated) → Session is silently dropped. No CRM pollution.
    *   **Phased Persistence**:
        *   **Phase 1**: In-Memory / Local JSON.
        *   **Phase 2**: Firestore.
    *   **Timeout**: **60 Seconds** (Unified System Timeout).
    *   **Inactivity**: Session closes after 15 minutes.
*   **Guardrails (3-Tier System)**:
    *   **Timeout Handling**: If an agent call hangs for >60s, cancel.
    *   **Business Guardrails**: CEO escalation for critical/out-of-scope actions.
    *   **Persona Integrity (3 Tiers)**:
        *   **CEO** (`profile_type: "CEO"` or CEO email): Full transparency. May discuss AI architecture, sub-agent names, system internals.
        *   **Staff** (`profile_type: "Staff"` or non-CEO staff email): Kalyani persona. MAY share operational details (occupancy, maintenance, tenant status, task lists, schedules). Must NOT reveal AI architecture, sub-agent names, or system internals.
        *   **Customer** (default / `profile_type: "Customer"`): Kalyani persona. MAY share room types, pricing, amenities, visit scheduling, their own booking/payment status. Must NOT share other tenants' info, internal staff details, occupancy numbers, revenue, operational costs, or system architecture.
    *   **Atomic Workflows (Transactional Safety)**:
        *   **Rule**: Multi-step workflows (e.g., Tenant Onboarding = Assign Unit + Record Payment) must be **Atomic**.
        *   **Compensation Logic**: If Step `N` fails, MasterAI must execute "UndoTool" for Steps `1...N-1` to revert the system to a clean state.
        *   **No Half-Done States**: A workflow is either `COMPLETED` or `ROLLED_BACK`.

---

## 3. Property AI (Assets)
*   **Role**: Inventory & Asset Manager.
*   **Description**: Responsible for managing all physical assets (Properties, Units) and their current status (Booked/Available/Notice).
*   **Responsibilities**:
    *   **Inventory**: Manage hierarchy (Building -> Unit) and Deletes.
    *   **Unit Specs**: Units have `types` (e.g., "Double Sharing", "Bunk Bed", "Balcony") and `floor`. A unit can have multiple types.
    *   **Tenancy**: Map Tenants to Units (`assign_tenant` / `vacate_tenant`).
    *   **Meters**: Manage Electricity Meters and Readings (A group of units share a single meter).
    *   **Maintenance**: Track repair requests (`Log Ticket` -> `Resolve`).
    *   **Public Rates**: Maintain standard market prices (MRP).
    *   **Logical Delete**: If a Unit/Property has *accounts history*, it is Disabled (soft delete), never hard-deleted.
    *   **Amenities Management**:
        *   Properties have amenities associated at creation.
        *   Units inherit these amenities (subset possible).
        *   *Customer Query*: When asked for facilities, quote the Property-level amenities.
*   **Status Transitions**: `AVAILABLE`, `BOOKED`, `NOTICE`.
    *   **Double Booking Prevention**:
        *   New booking on a unit is ONLY allowed if the current tenant is in 'Notice Period' (or if it's empty).
    *   **Tenant Mapping**:
        *   `assign_tenant(lead_id, unit_id)`: Links a human to a unit. Vital for generating bills.

*   **Rate Card Logic (Public / Standard)**:
    *   *Description*: You hold the Standard Market Rates (MRP). This is the starting point for negotiation. Once finalized and sent to FinanceAI as a **Negotiated Rate Card**, the customer is onboarded.
    *   `monthly_rent`: 12000
    *   `base_security_deposit`: 2500
    *   `payment_cycle_rules`:
        *   **1st-5th**: Standard Deposit.
        *   **6th-10th**: **Additional Deposit** (Standard Deposit + Dynamic Calculation).
            *   *Dynamic Calculation*: `(Daily_Rent * 5)` rounded to nearest 50.
    *   `notice_period_days`: 30
    *   `min_stay_months`: 6
    *   `early_exit_rule`: "DEPOSIT_FORFEIT"
    *   `rent_payment_timing`: "ADVANCE" (Pre-paid)
    *   `utility_payment_timing`: "ARREARS" (Post-paid)
    *   **Fine & Fee Structure**:
        *   `maintenance_fee`: 0 (Fixed).

---

## 4. CRM Agent
*   **Role**: Lead & Tenant Relationship Manager.
*   **Description**: You are the memory of every human interaction. From the first "Hello" (Lead) to the last goodbye (Tenant), you record their story — every call, visit, complaint, and preference — as an append-only chronological log. You never manage the Property they stay in, only their experience of it. Nothing is overwritten; every interaction is a new entry.
*   **Inputs**: WhatsApp, Phone Calls, Emails (via MasterAI).
*   **Identity Rule**: The **lead_id IS the E.164 canonical mobile number** (e.g., `+919800098000`).A human is identified by their phone. Additional numbers stored in `phones.others` with WhatsApp status tracked per number.
*   **Core Principle**:
    *   **Timeline**: STRICTLY Append-only. Every interaction is a new timestamped event.
    *   **Snapshot**: Mutable Projection. Can be updated in-place to reflect the "Current Best Truth" derived from the timeline.
*   **Identity Resolution & Merging Rules**:
    *   **Implicit Referral (Direct Visit)**: If a lead's status is detected as `Visited` *without* a prior `Enquiry` record (Direct Walk-in), it implies a proxy enquiry.
        *   *Action*: Search for a recent enquiry that matches the context.
        *   *Merge*: Merge the *original enquiry lead* INTO this *new visiting lead*.
        *   *Append*: A `MERGE` event is written to the timeline. Add the original lead's phone to `phones.others`. Record the relationship (e.g., "Friend", "Parent") if available.
    *   **Existing Customer Verification**: If a caller claims to be an existing customer (identifies by name) and the name matches a record:
        *   *Action*: Trust the identity.
        *   *Append*: A `CORRECTION` event updating contact details (add new number to profile).
*   **Lifecycle (The "4-Bucket" Strategy)**: `Enquiry` → `Visited` → `Onboarded` → `Left`. The cycle can **repeat** — a person who left can enquire again. Every transition is dated.
*   **CRM Data Pillars**:
    *   **User Profile Snapshot**:| `leads` | `lead_id` (= primary phone, e.g., `+919800098000`) | Lead Snapshot (profile, demographics, preferences). |`source`, `unit_type_required`, `ai_notes`, `profile_type`).
        *   **`profile_type`**: "Customer" (Default), "Staff", "CEO". Used to determine permissions and context loading rules.
    *   **Artifacts**: Immutable files (call recordings, transcripts, images, PDFs, workflow logs) stored in GCS, referenced via links.
    *   **Session**: Record of a single conversation — `summary`, `sentiment`, `tone`, `financial_impact`, `compliance_impact`, `participants`, and links to artifacts/workflows.
    *   **Status**: Lifecycle bucket transitions, each recorded as a dated `STATUS_CHANGE` event.
*   **Snapshot Process** (Triggered by MasterAI after each single session):
    1.  **Retrieve Assets**: Receives the **Audio Recording** and **Transcript**.
    2.  **Generate Metadata**: Extract **Summary**, **Sentiment**, **Tone**, **Financial Impact**, **Compliance Impact**.
    3.  **Enrich User Profile Snapshot**: Update profile with any new information (e.g., college, email, preferences, source) and AI insights (`ai_notes`).
    4.  **Identity Checks (Merge Logic)**:
        *   *Implicit Referral*: If the sentiment/summary indicates a "Direct Visit" without prior enquiry, trigger the **Implicit Referral** merge logic.
        *   *Existing Customer*: If the summary identifies the caller as an existing customer (by name), trigger the **Existing Customer Verification** logic.
    5.  **Append**: Store as a new `SESSION` event with all metadata and artifact links in the lead's timeline.


---

## 5. Human Resources Agent (Staff)
*   **Identity**: `HRAgent`
*   **Role**: Staff Manager.
*   **Description**: You manage the people who work for the business. You handle hiring, firing, and define compensation agreements (Salary Cards).
*   **Responsibilities**:
    *   **Lifecycle**: Hiring (Creation of Job Descriptions), Firing of staff.
        *   *Sync Rule*: When a new staff member is hired, HR Agent emits a `staff.hired` event. MasterAI listens for this event and calls **CRM Agent** to create/update the profile with `profile_type = "Staff"`.
    *   **Leaves**: Manage staff leaves (Advance Leave, Emergency Leave).
    *   **Incentives**: Calculate performance-based incentives (e.g., based on unit occupancy).
    *   **Compensation**: Defines the Salary Card (Salary Agreement).
    *   **Handover**: Passes Salary Card to Finance AI (Salary Agent) for execution ("Once salary is negotiated, it is sent to FinanceAgent for monthly processing").
*   **Capabilities**:
    *   **Skills**: Staff Management, Compensation Structuring, Hiring/Firing Workflows, Leave & Attendance Management.
*   **Directives**:
    *   **Goals**: Ensure staff data is up to date. Define clear salary agreements for the Finance Agent to execute.
    *   **Constraints**: Cannot disburse money (that is Finance's job).
*   **Hierarchy**:
    *   **Supervisor**: MasterAI
    *   **Sub-Agents**: None
*   **Salary Card (Schema)**:
    ```json
    {
      "lead_id": "+919800098000",
      "designation": "Property Manager",
      "job_description": "Manage day-to-day operations, tenant grievances, and vendor supervision.",
      "contact": {
        "primary": { "number": "+919800098000", "whatsapp": true },
        "email": "manager@property.com",
        "alternate": [
          { "number": "+919988776655", "whatsapp": false },
          { "number": "+917900079000", "whatsapp": false }
        ]
      },
      "bank_details": {
        "account_holder": "Raamesh Kumar",
        "account_number": "1234567890",
        "ifsc": "HDFC0001234",
        "bank_name": "HDFC Bank",
        "upi_id": "raamesh@hdfcbank",
        "qr_code_image": "https://storage.googleapis.com/bucket/qr_images/stf-05.jpg"
      },
      "base_salary": 4000,
      "components": {
        "salary_advance_limit": 5000,
        "reimbursements_allowed": true,
        "incentives": {
          "logic": "Units Occupied * Amount Per Unit",
          "amount_per_unit": 350
        },
        "allowances": {
          "travel": 1000,
          "phone": 500
        }
      },
      "effective_from": "2024-01-01"
    }
    ```

---

## 6. Finance AI (CFO)
*   **Role**: Chief Financial Officer (Guardian of the Ledger).
*   **Description**: You are the guardian of the ledger. Your scope is Value.
    *   **Demographic Blindness**: You do NOT care about names, genders, or preferences.
    *   **Account Awareness**: You DO care about the `lead_id` (Phone Number) as the Account Key for the ledger.
*   **Constraints**:
    *   **Surety Rule**: You must NOT update any transaction unless you are absolutely sure about it. Double-checking is encouraged.
    *   **Delegated Execution**: FinanceAI itself does not work; it uses its sub-agents to do the work.

*   **Transaction Schema**:
    *   **Incoming (Revenue)**:
        *   `txn_id`: "IN-XXXX"
        *   `amount`: 15000 (The actual cash received)
        *   `date`: Received Date (IST)
        *   `payer_id`: Lead/Tenant ID
        *   `payment_mode`: "UPI" / "Cash" / "Payment Gateway" / "Net Banking"
        *   `allocations`: [List of `Allocation` Objects] (Populated *automatically* by the Waterfall Logic)
        *   `attachment`: Link to Receipt/Screenshot
        *   *Note*: We do not tag "Jan Rent" here manually. The Waterfall Logic allocates this cash to the correct Ledger buckets.
    *   **Outgoing (Expense)**:
        *   `txn_id`: "OUT-XXXX"
        *   `category`: "OpEx" / "CapEx"
        *   `sub_category`: "Goods/Services"
        *   `work_done`: Description of work (replaces sub_cat detail)
        *   `property_id`: Linked Asset
        *   `amount`: 500
        *   `date`: Creation Date (IST)
        *   `payee`: Vendor Name
        *   `payment_mode`: UPI/Cash
        *   `approved_by`: "Jatin (Manager)"
        *   `remarks`: Notes

*   **Ledger Logic (The Source of Truth)**:
    *   *Concept*: The "Bill" is just a monthly statement. The **Ledger** is the actual database of Debts (`entries`).
    *   **Ledger Entry Schema (The "Bucket")**:
        *   `entry_id`: "LED-101"
        *   `payer_id`: "User-A" (The Tenant or Lead who owes this money)
        *   `category`: "Rent" / "Electricity" / "Late Payment Fee" (Matches Priority List)
        *   `month_year`: "Jan 2024" (The period this charge belongs to)
        *   `amount_due`: 12000 (The original charge)
        *   `amount_paid`: 10000 (How much has been covered by Transactions)
        *   `balance`: 2000 (Calculated)
        *   `status`: "PARTIALLY_PAID" / "PAID" / "PENDING"

*   **Payment Allocation Logic (The Waterfall)**:
    *   *Rule*: Incoming payments are automatically allocated to "Buckets" in this strict priority order. Any "Past Dues" (Arrears) are treated as a high-priority bucket (after Deposit) to ensure old debts are cleared before current service charges.
    *   **Priority Order**:
        1.  **Security Deposit** (Top Priority)
        2.  **Past Dues** (Total Pending from previous cycles)
        3.  **Police Verification Fee**
        4.  **Rent**
        5.  **Parking Fee**
        6.  **Wi-Fi Fee**
        7.  **Electricity Bill**
        8.  **Asset Damage Recovery**
        9.  **Late Payment Fees**

*   **Sub-Agents**:
    1.  **Billing Agent**:
        *   *Action*: Generates **Ledger Entries** (Debits) for the tenant.
        *   *Logic*:
            *   **Billing Rule**: Calculates bill strictly according to the **Negotiated Rate Card** stored in Finance AI for the specific tenant.
            *   **Rent**: Calculates Pro-rata if needed, adds `Rent` entry to Ledger based on `rent_payment_timing`.
            *   **Electricity**: Calculates `(Reading - Last_Reading) * Rate`, adds `Electricity` entry based on `utility_payment_timing`.
            *   **Bill Generation**: Generates a **Link** to a PDF "Statement" (stored in GCS) showing Current Month Charges + Past Unpaid Dues.
                *   **Visual Rule**: The items in the bill MUST be sorted by the **Payment Allocation Priority** (Top priority items shown first).
            *   **Fees**:
                *   `late_payment_fee_daily`: Adds `Late Payment Fee` entry if due date crossed on unpaid Ledger buckets.
    2.  **Accounting Agent**:
        *   *Responsibilities*: Maintains the accounts for tenants/leads, salary, and outgoing transactions for the business.
        *   **Customer/Staff Ledger (Balance Sheet)**:
            *   Maintains a specific ledger per `lead_id` and `staff_id`.
            *   *Logic*: `Balance = Previous_Due + New_Bill - Payments`.
    3.  **Salary Agent**:
        *   *Logic*: Calculates Salary and Advances based on the Salary Card defined by HR.

---

## 7. Communications AI (Gateway)
*   **Role**: Communications AI is the system’s communication gateway that connects users to the platform through channels such as WhatsApp, Email, Voice calls, and future communication methods.
*   **Description**:
    *   It handles communication only.
    *   All decisions always come from MasterAI.
    *   Its multimodal.
*   **Responsibilities**:
    *   Receiving messages or calls from external channels.
    *   Sending messages when instructed.
    *   Converting communication into system events.
    *   Converting system responses into user-facing communication.
    *   Formatting messages for the correct channel.
    *   Ensuring delivery succeeds or retrying if needed.
    *   Securely managing external provider connections.
*   **Internal Structure**:
    *   CommunicationsAI contains adapters, not agents.
    *   Adapters are connectors to external communication systems.
    *   These adapters do not contain intelligence or decision logic.
    *   They only allow the system to interact with external platforms.
*   **Adapters**:
    *   **WhatsApp Adapter — Must Be Able To**:
        *   Send messages.
        *   Receive messages.
        *   Send media.
        *   Report delivery status.
        *   Notify system when new message arrives.
        *   Securely authenticate with provider.
    *   **Email Adapter — Must Be Able To**:
        *   Send emails.
        *   Receive emails.
        *   Handle attachments.
        *   Detect replies and threads.
        *   Report delivery success or failure.
        *   Securely authenticate.
    *   **Voice Adapter — Description**:
        *   The Voice Adapter enables the system to handle voice calls from different sources such as SIP, browser calls, app calls, or telecom providers.
        *   It standardizes all voice interactions so the rest of the system sees every call in a consistent format.
        *   It does not generate speech or understand speech itself. Those functions are handled by an external voice renderer.
        *   **We are only working with sip adapter right now.**
    *   **SIP Voice Adapter — Must Be Able To**:
        *   Accept calls.
        *   End calls.
        *   Detect missed calls.
        *   Detect waiting calls.
        *   Provide transcripts.
        *   Provide call recordings.
    *   **SIP Voice Adapter — Special Capabilities**:
        *   **Pre-Call Context**: Before answering, it should fetch basic caller context so the system already knows who is calling. It should be able to call MasterAI and inject this context into the external voice system.
        *   **Live Context Access**: During a call, it must be able to request additional information from the system when needed. This should be exposed by the adapter for the external system to consume.
*   **Core Principle**:
    *   CommunicationsAI handles communication, not decisions.
    *   CommunicationsAI is a channel-agnostic gateway that connects external communication systems to MasterAI through standardized events.


