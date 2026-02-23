# ChatPanel Design Decisions

## 1. Local State Only for Messages
- **Why built this way:** Adheres to the strict architectural rule forbidding global state for business/agent data.
- **Alternatives considered:** Zustand or React Context for global chat history.
- **Why rejected:** Violates the "forbidden global state" architectural rule.
- **Assumptions made:** If the user navigates away, they intend to clear the local session.

## 2. Optimistic Updates vs. Revert
- **Why built this way:** Ensures high perceived performance by appending user messages immediately.
- **Alternatives considered:** Blocking the UI and waiting for the API to return before showing the user's message.
- **Why rejected:** Creates a sluggish interface experience, especially depending on MasterAI processing time.
- **Assumptions made:** Network failures are rare enough that the "slice off" reversion strategy is acceptable UX.

## 3. Transparency Elevation (`onLogRequest`)
- **Why built this way:** Satisfies the transparency rule without cluttering the chat bubble UI.
- **Alternatives considered:** Rendering the `RequestLogItem` inline underneath every chat bubble.
- **Why rejected:** In a fast back-and-forth chat, inline network traces destroy readability and conversational flow.
- **Assumptions made:** The parent orchestrator (`ControlPanel`) will mount a sibling component (`LatencyDisplay`) to actually render the emitted logs.
