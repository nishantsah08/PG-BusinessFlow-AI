# Sidebar Specification

## Purpose
Provides vertical navigation linking to the primary system interfaces (`/master`, `/dashboard`, `/monitor`). Persists across authenticated routes.

## Scope
- Render navigation links styled as pills.
- Indicate the active route using matching background styling.
- Display a small animated "System Online" heartbeat status at the bottom to comply with Architectural Rule 4 (Continuous visibility).

## Inputs
- Inherits the current route from React Router implicitly via `NavLink`.

## Dependencies
- `react-router-dom`: specifically `NavLink` for active-state routing.
- `lucide-react`: `MessageSquare`, `LayoutGrid`, `Activity` icons.
