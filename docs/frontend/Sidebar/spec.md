# Sidebar Specification

## Purpose
Provides vertical navigation linking to the primary system interfaces (`/master`, `/dashboard`, `/workflows`). Persists across authenticated routes.

## Scope
- Render navigation links styled as pills (Master AI, Agent Dashboard, Workflows).
- Conditionally hide the "Agent Dashboard" link if Developer Mode is disabled.
- Indicate the active route using matching background styling.
- Display a small animated "System Online" heartbeat status at the bottom to comply with Architectural Rule 4 (Continuous visibility).

## Inputs
- Inherits the current route from React Router implicitly via `NavLink`.

## Dependencies
- `react-router-dom`: specifically `NavLink` for active-state routing.
- `lucide-react`: `MessageSquareCode`, `Activity`, `FolderKanban` icons.
- `DeveloperModeContext`: Conditionally renders developer-only links like the Agent Dashboard.
