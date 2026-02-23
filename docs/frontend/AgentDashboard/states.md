# AgentDashboard States

## Loading State
- **Trigger:** Initial mount or subsequent full-refresh request to `GET /api/system/agents`.
- **UI:** Global or inline spinner provided by `StateWrapper`.

## Success State
- **Trigger:** `GET /api/system/agents` returns `success: true` and `data.agents.length > 0`.
- **UI:** Grid or list of `AgentCard` components displaying status indicators and control buttons.

## Empty State
- **Trigger:** `GET /api/system/agents` returns `success: true` but `data.agents` is empty or missing.
- **UI:** `StateWrapper` displays placeholder text "No agents currently registered in the system."

## Error State
- **Trigger:** `GET /api/system/agents` throws Network Error or `success: false`.
- **UI:** `StateWrapper` displays the error message and a "Retry" button.

## Retry State
- **Trigger:** User clicks "Retry" on Error state or forces a refresh.
- **UI:** Resets to Loading state and re-invokes data fetch.

## Interaction/Optimistic States
- **Toggle Optimistic:** Toggle is clicked, UI immediately shows new state and disables button with a spinner.
- **Toggle Reversion:** POST fails, UI reverts toggle to original position, enables button, and fires a toast.
