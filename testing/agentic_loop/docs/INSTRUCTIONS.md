# Testing Agentic Loop Instructions

## Source of Truth
- Keep all ongoing testing instructions in `testing/agentic_loop/docs`.
- Do not write testing instructions in `testing/hrAgent/docs`.

## Persona Separation Rule
- Keep unique names and persona identity per agent.
- Do not reuse the same behavior mode across all personas.

## Trait Modeling Rule
- Every persona trait must use a left-to-right `scale`.
- Canonical scale direction: `left = ideal/default baseline`, `right = worst/extreme`.
- Canonical scale range: `0..100`.
- Canonical term for the line: `spectrum`.
- Property volume per CEO must be scale-driven, not uniform across all personas.

## Required Traits
- `operational_tempo`: deliberate -> rapid
- `risk_appetite`: conservative -> aggressive
- `validation_depth`: deep -> shallow
- `channel_preference`: module_forms -> chat_only

## Execution Rule
- Default start condition for every testing run:
- Email/UI personas must first be logged into PG-BusinessFlow.ai portal with their CEO email identity.
- WhatsApp persona must have the CEO mobile number configured and available before any test step.
- This precondition is mandatory on every test start; do not skip.
- At least two different execution paths in each multi-persona run.
- Persist evidence in `testing/agentic_loop/issues`.
- For failures: create self-sufficient folder `Issue-XX - <detail>`.
- For non-blocking recommendations: create self-sufficient folder `Improvement-XX - <detail>`.
- Every issue folder must be fully self-sufficient; a separate run folder must not be required to understand or execute a fix.
- Testing execution is UI-only for all personas.
- For chat-only persona, include image attachments where possible during chat execution.
- For chat-mode validation, run through the live Chat UI (not API-only/tool-only) to complete the scenario.
- Rohan Iyer must run via WhatsApp simulator chat interface only: `/home/nishant/PG-BusinessFlow.ai/whatsapp_simulator`.
- Rohan uses the same conversational protocol as Maya (multi-turn, response-driven, attachment-aware).
- Maya and Rohan both must read incoming assistant text from API responses each turn to avoid UI text-read ambiguity.
- Maya incoming source of truth: `/api/communications/chat` response payloads.
- Rohan incoming source of truth: `/api/simulator/whatsapp/thread` response payloads.
- Maya and Rohan must continue reading and following assistant messages until test completion (explicit success) or explicit terminal failure.
- Chat latency handling is internal to CEO agent operations; no mandatory user-facing latency note.
- Chat-mode testing must be conversational and multi-turn; single prompt testing is invalid.
- Tester must read MasterAI replies and follow requested next steps before declaring success/failure.
- If MasterAI asks for images or clarifications, tester must provide them in the same conversation flow.
- Screenshot capture and issue/improvement packaging rules remain unchanged for all personas.
- No backend calls/tooling fallback are allowed for any persona. If primary UI channel flow fails, log issue; do not switch channels.

## Chat Conversation Protocol (Mandatory)
1. Send initial task in MasterAI chat.
2. Read MasterAI response fully.
- Read source of truth for each turn from `/api/communications/chat` response payloads.
3. Determine response intent before next action:
- If MasterAI asks for missing fields, provide exactly those fields.
- If MasterAI asks for confirmation (example: `Shall I proceed?`), reply explicitly (`Yes, proceed` or `No, stop`) before sending any new edit request.
4. Execute MasterAI-requested follow-up actions in chat (attachments, clarifications, confirmations).
4. Repeat until terminal state:
- Success confirmation from MasterAI, or
- Explicit terminal error from MasterAI.
5. Capture evidence across turns:
- Screenshot at critical turns
- Prompt/response trail
- Final outcome proof in app state

## WhatsApp Simulator Protocol (Rohan - Mandatory)
1. Use only `/home/nishant/PG-BusinessFlow.ai/whatsapp_simulator` chat interface.
2. Start with business request, then wait for MasterAI follow-up.
3. Read incoming assistant text from `/api/simulator/whatsapp/thread` response payloads per turn.
4. Respond only to requested missing fields per turn.
5. If MasterAI asks `Shall I proceed?` or equivalent confirmation, send explicit confirmation before moving to next field.
6. Attach images/documents when MasterAI asks.
7. Continue until explicit completion or explicit terminal failure.
8. If failed, create issue pack from WhatsApp conversation evidence; do not use backend fallback.

## Root Cause First Rule (Mandatory)
1. Before changing scripts/instructions after a failed run, identify root cause with direct evidence (API payloads, screenshots, error text).
2. Apply updates only after root cause is clear.
3. Record the root cause statement in the issue context before proposing fixes.

## Current Persona Scale Config
- Reference: `testing/agentic_loop/docs/persona_trait_scales.json`.

## Browser Execution Visibility Rule (Mandatory)
1. During browser-based testing, run in headed mode so the browser is visible on screen.
2. Start browser maximized (or equivalent full-screen viewport) for each test run.
3. Keep browser open on screen during execution for live observation.
4. Keep a minimum `1 second` gap between browser navigation/actions (page switches, major clicks, submit transitions) during test execution.
