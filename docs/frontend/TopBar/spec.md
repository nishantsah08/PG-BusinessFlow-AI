# TopBar Specification

## Purpose
Provides the application header, persistent across all authorized routes, containing branding, settings access, and the global logout action.

## UI Elements
- **Branding**: Displays "PG pgbusinessflow.ai"
- **Settings Button**: Interactive UI element intended to open application settings (functionality pending implementation).
- **Logout Button**: Triggers session termination via AuthContext.

## Dependencies
- `lucide-react`: Arrow and Settings icons.
- `AuthContext`: Utilizes the `useAuth` hook to trigger `logout()`.
