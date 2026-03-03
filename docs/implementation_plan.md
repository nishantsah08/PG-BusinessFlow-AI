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

## 2. Master AI (Orchestrator) (Phase 1)
**Persona**: Kalyani (Head of Operations & Sales)
**Role**: Dynamic Workflow Engine & Orchestrator.
**Architectural Decision**: MasterAI is a **Pure Logic Engine**. Infrastructure is offloaded to specialized APIs.

### 2.1 Core Responsibilities
*   **Context Management**:
    *   **Start of Interaction**: Fetches Context via dual lookup (phone `get_lead_by_phone` OR email `get_lead_by_email`) from **CRM Agent**. For known users, also loads **last 3 SESSION events** for conversation memory.
    *   **End of Interaction**: Updates Context (New Information + Decisions) in **CRM Agent**.
    *   **Deferred Lead Creation**: Unknown users get a temporary in-memory context. At session timeout, MasterAI classifies the conversation via LLM. Business-relevant → CRM lead created + session logged. Not relevant → silently dropped.
    *   **Role-Based Loading**:
        *   **Customer**: Loads CRM profile + last 3 conversations. Kalyani persona with customer-specific share/don't-share rules.
        *   **Staff**: Loads CRM profile. Kalyani persona with operational access (occupancy, tasks, schedules). No AI internals.
        *   **CEO**: Full transparent access. May discuss architecture, sub-agents, system internals.
*   **Decision Engine**:
    *   Analyzes incoming **Events** (Webhook/Timer) + **Context**.
    *   Selects the appropriate **Workflow** or **Direct Tool**.
    *   Orchestrates **Atomic Business Transactions** (e.g., Booking = Update Unit + Record Payment).
*   **Guardrails (3-Tier)**:
    *   Enforces "Kalyani" persona integrity with tier-specific rules (CEO/Staff/Customer).
    *   Manages system timeouts (60s) and retry logic.
    *   **Phase 1**: Simulates all external dependencies (Payment/Email/WhatsApp) via mock events.

### 2.2 Master AI API Skills (Exhaustive)
MasterAI exposes tools for **Internal Logic Control** and **Admin Dashboard (GUI/CLI)**.

#### Chat / Logic Tools (Internal MCP)
These tools are used by the MasterAI Logic Engine to control the flow of the system.
*   **`get_session_context`**:
    *   *Inputs*: `user_id` (Phone Number or Email).
    *   *Returns*: `{ profile: {...}, recent_sessions: [...] (last 3 SESSION events), active_workflows: [...] }`
    *   *Purpose*: Loads the "Brain" with memory before processing a message. Supports dual lookup (phone + email).
*   **`update_session_context`**:
    *   *Inputs*: `user_id`, `data` (Key-Value pairs).
    *   *Purpose*: Updates short-term memory during a conversation (e.g., "User is currently booking a visit").
*   **`eval_rule`**:
    *   *Inputs*: `rule_expression`, `context` (Object).
    *   *Returns*: Boolean.
    *   *Purpose*: Evaluates dynamic business rules (e.g., "Is User VIP?").
*   **`trigger_workflow`**:
    *   *Inputs*: `workflow_id`, `context` (Object).
    *   *Purpose*: Manually initiates a named business process (e.g., `trigger_workflow("onboard_tenant", { lead_id: "..." })`).
*   **`emit_system_event`**:
    *   *Inputs*: `event_type`, `payload`.
    *   *Purpose*: Publishes an event to the Event Bus (e.g., `payment.received`).

#### GUI / Admin Tools (Dashboard)
These tools are used by the Admin Panel to monitor, manage, and verify the Orchestrator.

**System Monitoring & Control**:
*   **`get_system_health`**:
    *   *Returns*: Status of all connected agents (Online/Offline), Message Queue depth, Error rates.
*   **`agent_control`**:
    *   *Inputs*: `agent_name`, `action` (restart/disable/quarantine).
    *   *Purpose*: **Health Enforcement**. Allows MasterAI to isolate or reboot misbehaving agents.
*   **`reset_system_state`**:
    *   *Purpose*: **Phase 1 Only**. Clears all in-memory sessions and workflows to start fresh.
*   **`set_simulated_time`**:
    *   *Inputs*: `timestamp` (ISO 8601).
    *   *Purpose*: **Phase 1 Only**. Fast-forwards system time to test timeouts and scheduled events.
*   **`toggle_mock_failure_mode`**:
    *   *Inputs*: `agent_name`, `failure_rate` (0.0 - 1.0).
    *   *Purpose*: **Phase 1 Only**. Simulates random failures in specific agents to test MasterAI's retry/recovery logic.

**Event Management (The "Nerves" - Gap Fill)**:
*   **`register_event_handler`**:
    *   *Inputs*: `event_type`, `workflow_id` (or Callback URL).
    *   *Purpose*: **Subscription Interface**. Dynamically binds an event (e.g., `payment.received`) to a specific workflow.
*   **`replay_event`**:
    *   *Inputs*: `event_id`.
    *   *Purpose*: Re-processes a specific past event (e.g., if a workflow bug caused it to be mishandled).

**Workflow Operations (Runtime)**:
*   **`list_active_workflows`**:
    *   *Inputs*: `filter` (e.g., "pending_approval", "failed").
    *   *Returns*: List of seemingly "stuck" or active multi-step workflows.
*   **`get_workflow_details`**:
    *   *Inputs*: `workflow_instance_id`.
    *   *Returns*: Current step, history of steps executed, current variable state.
*   **`pause_workflow`**:
    *   *Inputs*: `workflow_instance_id`.
    *   *Purpose*: Temporarily halts a workflow for manual inspection.
*   **`resume_workflow`**:
    *   *Inputs*: `workflow_instance_id`.
    *   *Purpose*: Resumes a paused workflow from the last successful step.
*   **`cancel_workflow`**:
    *   *Inputs*: `workflow_instance_id`, `reason`.
    *   *Purpose*: Forcefully stops a stuck workflow.
*   **`retry_workflow_step`**:
    *   *Inputs*: `workflow_instance_id`, `step_id`.
    *   *Purpose*: Retries a failed step (e.g., after fixing a bug or network issue).

**Transaction & Session Management (Logic Enforcers)**:
*   **`execute_compensation`**:
    *   *Inputs*: `workflow_instance_id`, `start_step_id`.
    *   *Purpose*: **Transaction Compensation**. Triggers the "Undo" logic (Rollback) for a failed multi-step workflow.
*   **`finalize_session`**:
    *   *Inputs*: `session_id`, `reason`.
    *   *Purpose*: **Session Hook**. Forces the closure of a session and triggers the **CRM Snapshot Process**.
*   **`escalate_to_human`**:
    *   *Inputs*: `context`, `urgency` (Low/High/Critical), `reason`.
    *   *Purpose*: **Escalation Channel**. Pauses automation and flags for human (CEO/Manager) review.

**Agent & Skill Discovery (Dynamic Usage)**:
*   **`discover_agent_skills`**:
    *   *Inputs*: `agent_name` (Optional).
    *   *Returns*: JSON Schema of all available tools and their input requirements.
    *   *Purpose*: **Skill Discovery**. Allows MasterAI to validate tool calls against current agent capabilities before execution.
*   **`execute_subagent_tool`**:
    *   *Inputs*: `agent_name`, `tool_name`, `parameters`.
    *   *Returns*: Result of the tool execution.
    *   *Purpose*: **Direct Delegation**. Allows the Admin Dashboard to perform synchronous CRUD operations via MasterAI, ensuring MasterAI maintains observability (emitting `tool.execution_start` / `tool.execution_end` events).

**Observability & Debugging**:
*   **`get_recent_events`**:
    *   *Inputs*: `limit`, `topic_filter`.
    *   *Returns*: Raw log of events published to the Event Bus.
*   **`get_decision_history`**:
    *   *Inputs*: `workflow_instance_id`.
    *   *Returns*: Log of why MasterAI made specific decisions (Rule evaluations, branch choices).
*   **`inject_mock_event`**:
    *   *Inputs*: `event_type`, `payload`.
    *   *Purpose*: Simulates an external event (e.g., pretend "Razorpay Webhook" arrived) for testing.

**Configuration & Policy Management (Validation at Creation/Update)**:
*   **`define_workflow`**:
    *   *Inputs*: `workflow_id`, `name`, `description` (Required — MasterAI uses this to decide when to trigger), `trigger_event`, `steps` (Array).
    *   *Trigger Mechanisms*: Event-based (matching system event), Timer-based (scheduled interval), or MasterAI-decided (based on conversation context and workflow description).
    *   *Purpose*: Creates a new standardized business process.
    *   *Validation*: User must approve the logic here. Once defined, it is executed autonomously.
*   **`update_workflow`**:
    *   *Inputs*: `workflow_id`, `name`, `description`, `trigger_event`, `new_steps`.
    *   *Purpose*: Updates an existing flow. Requires re-validation by User.
*   **`update_system_rule`**:
    *   *Inputs*: `rule_key`, `value` (e.g., `global_timeout_ms`).
    *   *Purpose*: Hot-swap logic parameters.

### 2.3 Phase 1 Implementation Details
*   **Storage**:
    *   Use `data/sessions.json` for active session state (simulating Firestore).
    *   Use `data/workflows.json` for workflow definitions and active instance tracking.
*   **Mocking**:
    *   **Auth**: No real JWT/OAuth. Trust all local requests for Phase 1.
    *   **Time**: Use system time, but allow "Time Travel" via a debug tool for testing expiry logic.
    *   **Dependencies**: All external APIs (WhatsApp/Email/Payment) are mocked via `console.log` and return success immediately.

---

## 3. Property AI (Assets)
**Role**: Inventory & Asset Manager.
**Logic**: Double Booking Prevention, Logical Deletes (Soft Delete if history exists).
**Status Transitions**: `AVAILABLE` → `BOOKED` → `NOTICE` → `AVAILABLE`. Also allows `NOTICE` → `BOOKED` (Rebooking). All other transitions are invalid and must be rejected.

### Tools
*   **`add_property`**
    *   *Inputs*: `name` (Unique), `address`, `description`, `google_business_link` (Optional), `image_urls` (Required: min 1), `amenities` (List), `floors`.
    *   *Output*: `property_id` (System Generated - Unique).
*   **`update_property`**
    *   *Inputs*: `property_id` (Target - Immutable), `name` (Unique), `address`, `description`, `google_business_link`, `image_urls`, `amenities`, `floors`.
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
**Core Principle**:
*   **Timeline**: STRICTLY Append-only. Event log.
*   **Snapshot**: Mutable Projection. Updated in-place.

---

### 4.1 User Profile Snapshot (The Person)
The User Profile Snapshot is the **profile of a human and their requirement**.

**Identity Rule**: The **lead_id IS the E.164 canonical mobile number** (e.g., `+919800098000`).
*   **Constraint**: If number changes, it is treated as a new Identity (or requires complex admin merge). We accept this risk for simplicity of `lead_id = phone`.

```json
{
  "lead_id": "+919800098000",
  "name": "Ankit Verma",
  "profile_type": "Customer",
  "email": "ankit.verma@example.com",
  "source": {
    "category": "Google Business Listing",
    "detail": null
  },
  "requirement_date": "2024-03-01",
  "phones": {
    "primary": { "number": "+919800098000", "whatsapp": true },
    "others": [
      { "number": "+917900079000", "whatsapp": false }
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
> **`lead_id` = `phones.primary.number`**: There is no separate generated ID. The person's E.164 canonical phone number IS their identity in the system. If Ankit's number is `+919800098000`, his `lead_id` is `+919800098000`.
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
> **`profile_type`**: Determines the user's role in the system.
> *   `Customer`: Default. Full CRM profile + last 3 conversations loaded. Kalyani persona with customer-specific guardrails.
> *   `Staff`: Internal users. CRM profile loaded. Kalyani persona with operational access (occupancy, tasks, schedules). AI internals hidden. Created/Updated via HR Agent sync.
> *   `CEO`: Full transparent access. May discuss architecture, sub-agents, system internals. Created/Updated via HR Agent sync.
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
*   **`get_lead_by_email`**: `email` (Strict case-insensitive lookup by email field).
*   **`search_leads`**: `query` (Partial name/email/phone), `limit`, `offset`.
*   **`get_leads_by_status`**: `status`, `limit`, `offset`.
*   **`get_recent_leads`**: `limit` (Sorted by last interaction).
*   **`get_dashboard_stats`**: Returns counts per status, leads created today, pending follow-ups.

#### Artifacts
*   **`link_artifact`**: `lead_id`, `file_url`, `file_type`, `description` (Manually attach file).
*   **`get_lead_artifacts`**: `lead_id`, `type_filter`.

## 5. Human Resources Agent (Staff)
**Role**: Staff Manager.
**Description**: You manage the people who work for the business. You handle hiring, firing, and define compensation agreements (Salary Cards).
**Responsibilities**:
*   **Lifecycle**: Hiring (Creation of Job Descriptions), Firing of staff.
*   **Leaves**: Manage staff leaves (Advance Leave, Emergency Leave).
*   **Incentives**: Calculate performance-based incentives (e.g., based on unit occupancy).
*   **Compensation**: Defines the Salary Card (Salary Agreement).
*   **Handover**: Passes Salary Card to Finance AI (Salary Agent) for execution ("Once salary is negotiated, it is sent to FinanceAgent for monthly processing").

### 5.1 Salary Card (Schema)
The definitive agreement for staff compensation. Handed over to Finance Agent.

```json
{
  "staff_id": "STF-05",
  "designation": "Property Manager",
  "job_description": "Manage day-to-day operations, tenant grievances, and vendor supervision.",
  "contact": {
    "primary": "+919876543210",
    "email": "manager@property.com",
    "alternate": ["+919988776655"]
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

### 5.2 HR Agent API Skills (Exhaustive)
The HR Agent exposes a comprehensive set of tools to support both **Chat (MasterAI)** and **GUI (Admin Dashboard)** operations.

#### Core Lifecycle & Profile
*   **`hire_staff`**:
    *   *Inputs*: `name`, `designation`, `job_description`, `contact` (primary, email, alternate), `base_salary`.
    *   *Output*: `staff_id` (System Generated).
    *   *Side Effect*: Emits `staff.hired` event. MasterAI receives it and calls `CRM_Agent.add_lead` to set `profile_type="Staff"`.
*   **`update_staff_profile`**:
    *   *Inputs*: `staff_id`, `name`, `designation`, `contact`, `job_description`.
*   **`terminate_staff`**:
    *   *Inputs*: `staff_id`, `reason`, `last_working_day`.
    *   *Logic*: Marks status as 'Inactive'. Triggers final settlement workflow.
*   **`get_staff_details`**:
    *   *Inputs*: `staff_id`.
*   **`get_all_staff`**:
    *   *Inputs*: `status_filter` (Active/Inactive), `designation_filter`.

#### Compensation & Finance Handover
*   **`create_salary_card`**:
    *   *Inputs*: `staff_id`, `bank_details`, `base_salary`, `components` (advance limit, reimbursements, incentives, allowances), `effective_from`.
    *   *Action*: Persist Salary Card and notify Finance Agent.
*   **`update_salary_card`**:
    *   *Inputs*: `staff_id`, `new_components`, `reason`.
    *   *Logic*: Updates the active agreement. Maintains history of changes.
*   **`get_salary_card`**:
    *   *Inputs*: `staff_id`.
    *   *Output*: Current active salary structure.

#### Leave & Attendance Management
*   **`record_leave`**:
    *   *Inputs*: `staff_id`, `leave_type` (Advance/Emergency/Casual), `start_date`, `end_date`, `reason`.
    *   *Logic*: Deducts directly from salary (Advance) or tracking balance (Casual).
*   **`get_staff_leaves`**:
    *   *Inputs*: `staff_id`, `month`, `year`.
*   **`approve_leave_request`** (GUI Workflow):
    *   *Inputs*: `request_id`, `status` (Approved/Rejected), `approver_note`.

#### Performance & Incentives
*   **`calculate_incentive`**:
    *   *Inputs*: `staff_id`, `metric_value` (e.g., Units Occupied count).
    *   *Logic*: Applies the formula defined in the Salary Card (e.g., `350 * 10`). Returns calculated amount.
*   **`get_performance_metrics`**:
    *   *Inputs*: `staff_id`, `month`.
    *   *Output*: KPI data (e.g., Occupancy rates, Tenant feedback score).

---

## 6. Finance AI (CFO)
**Role**: Chief Financial Officer (Guardian of the Ledger).
**Description**: The guardian of the ledger. Blind to "who" or "where" unless on a receipt. Strictly enforces Property (Rates) and HR (Salaries) contracts.
**Constraints**:
*   **Surety Rule**: Must not update any transaction unless absolutely sure (double-check encouraged).
*   **Delegated only**: FinanceAI itself does not work; it uses its sub-agents (Billing, Accounting, Salary) to do the work.

### 6.1 Data Schemas
#### Transaction Schema
*   **Incoming (Revenue)**: `txn_id` (IN-XXXX), `amount`, `date` (IST), `payer_id`, `payment_mode` (UPI/Cash/PG/NetBanking), `allocations` (List of objects), `attachment` (GCS Link).
*   **Outgoing (Expense)**: `txn_id` (OUT-XXXX), `category` (OpEx/CapEx), `sub_category`, `work_done`, `property_id`, `amount`, `date` (IST), `payee`, `payment_mode`, `approved_by`, `remarks`.

#### Ledger Entry Schema (The Bucket)
*   `entry_id`, `payer_id`, `category` (Rent/Electricity/LateFee), `month_year`, `amount_due`, `amount_paid`, `balance`, `status` (PAID/PENDING/PARTIALLY_PAID).

#### Negotiated Rate Card Schema (Per Tenant Contract)
*   `lead_id` (Primary Key), `monthly_rent`, `security_deposit`, `rent_payment_timing` (ADVANCE/ARREARS), `utility_payment_timing` (ADVANCE/ARREARS), `effective_from`.

### 6.2 Logic & Waterfall
*   **Waterfall Strategy**: Incoming payments are allocated to buckets in this priority:
    1. Security Deposit
    2. Past Dues (Arrears)
    3. Police Verification Fee
    4. Rent
    5. Parking Fee
    6. Wi-Fi Fee
    7. Electricity Bill
    8. Asset Damage Recovery
    9. Late Payment Fees
*   **Billing Rule**: Bills are generated strictly according to the **Negotiated Rate Card** stored in Finance AI.
    *   **Rent**: Pre-paid (timing set by `rent_payment_timing` in the negotiated card).
    *   **Electricity**: Post-paid (timing set by `utility_payment_timing` in the negotiated card).

### 6.3 Finance AI API Skills (Exhaustive)
The Finance AI exposes tools for MasterAI (Chat) and the Admin Dashboard (GUI).

#### Revenue & Collections
*   **`record_incoming_txn`**:
    *   *Inputs*: `amount`, `payer_id`, `payment_mode`, `date`, `attachment_url`, `txn_id` (Optional).
    *   *Logic*: Triggers the **Waterfall Logic** to allocate funds to ledger buckets.
*   **`get_txn_details`**:
    *   *Inputs*: `txn_id`.
    *   *Returns*: Full transaction record including its allocations.
*   **`get_incoming_txns`**:
    *   *Inputs*: `payer_id` (Optional), `date_range`, `limit`, `offset`.

#### Expenses & Outgoings
*   **`record_outgoing_txn`**:
    *   *Inputs*: `category`, `sub_category`, `work_done`, `property_id`, `amount`, `payee`, `payment_mode`, `approved_by`, `remarks`.
*   **`get_expenses`**:
    *   *Inputs*: `property_id` (Optional), `category`, `date_range`.

#### Ledger & Billing
*   **`get_ledger`**:
    *   *Inputs*: `payer_id` (Mandatory).
    *   *Returns*: List of all ledger buckets (debts) and current balances.
*   **`add_ledger_entry`**:
    *   *Inputs*: `payer_id`, `category`, `amount_due`, `month_year`, `reason`.
    *   *Usage*: Used by Billing Agent to create debts.
*   **`generate_monthly_bills`**:
    *   *Inputs*: `property_id` (Optional - for bulk), `month`, `year`.
    *   *Logic*: Directs Billing Agent to calculate dues based on **Negotiated Rates** and Meter Readings.
    *   *Output*: Returns a list of **GCS Links** to the generated PDF bills.
*   **`onboard_tenant_contract`**:
    *   *Inputs*: `lead_id`, `negotiated_rent`, `security_deposit`, `rent_payment_timing`, `utility_payment_timing`, `effective_from`.
    *   *Purpose*: Stores the final negotiated terms for a tenant.
*   **`get_tenant_statement`**:
    *   *Inputs*: `payer_id`, `month_year`.
    *   *Returns*: A summary of charges and payments for the period.

#### Salary & Staff Finance
*   **`process_salary_payout`**:
    *   *Inputs*: `staff_id`, `month`, `year`.
    *   *Logic*: Directs Salary Agent to calculate payout based on HR Salary Card.
*   **`record_salary_advance`**:
    *   *Inputs*: `staff_id`, `amount`, `reason`.

#### Dashboard & Analytics
*   **`get_financial_summary`**:
    *   *Inputs*: `date_range`, `property_id` (Optional).
    *   *Returns*: Total Inflow, Total Outflow, Outstanding Dues.
*   **`get_defaulters_list`**:
    *   *Inputs*: `threshold_days`, `limit`.
    *   *Returns*: Tenants with pending ledger entries beyond the threshold.

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

### 7.1 WhatsApp Adapter API Skills (Exhaustive)
The WhatsApp Adapter exposes a comprehensive set of tools for MasterAI to manage messaging.

#### Outbound Messaging
*   **`send_text_message`**:
    *   *Inputs*: `recipient_phone`, `content`, `preview_url` (Boolean).
    *   *Function*: Sends a standard text message. Handles formatting (bold, italics) automatically.
*   **`send_media_message`**:
    *   *Inputs*: `recipient_phone`, `media_type` (image/document/audio/video), `media_url`, `caption`.
    *   *Function*: Sends a media file. Supported types: JPG, PNG, PDF, MP4, MP3.
*   **`send_template_message`**:
    *   *Inputs*: `recipient_phone`, `template_name`, `language_code`, `components` (List of variables for header/body/buttons).
    *   *Function*: Sends a pre-approved template message (Required for business-initiated conversations).
*   **`send_location_message`**:
    *   *Inputs*: `recipient_phone`, `latitude`, `longitude`, `name`, `address`.
    *   *Function*: Sends a location pin.
*   **`send_contact_message`**:
    *   *Inputs*: `recipient_phone`, `contact_name`, `contact_phone`.
    *   *Function*: Sends a vCard contact.
*   **`send_interactive_message`**:
    *   *Inputs*: `recipient_phone`, `type` (list/button), `header`, `body`, `footer`, `action` (sections/buttons).
    *   *Function*: Sends a message with clickable buttons or a list menu.

#### Inbound Event Processing (Webhooks)
*   **`handle_incoming_message`**:
    *   *Trigger*: Webhook from Meta.
    *   *Function*: Parses incoming JSON, normalizes it to a system event (`message.received`), and forwards it to MasterAI.
*   **`handle_delivery_status`**:
    *   *Trigger*: Webhook from Meta.
    *   *Function*: Updates message status (sent/delivered/read) in the system.
*   **`download_media`**:
    *   *Inputs*: `media_id`.
    *   *Function*: Retrieves the actual media file from Meta's servers and uploads it to GCS.

#### Session & Contact Management
*   **`check_contact_status`**:
    *   *Inputs*: `phone_number`.
    *   *Function*: Verifies if a phone number is a valid WhatsApp account.
*   **`mark_message_as_read`**:
    *   *Inputs*: `message_id`.
    *   *Function*: Sends a 'read' receipt to the sender.
*   **`get_business_profile`**:
    *   *Function*: Retrieves the current business profile settings (about, address, email, websites).
*   **`update_business_profile`**:
    *   *Inputs*: `about`, `address`, `email`, `websites`, `profile_picture_url`.
    *   *Function*: Updates the WhatsApp Business profile details.


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
