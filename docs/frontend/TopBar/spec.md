# TopBar Specification

## Purpose
Provides the application header, persistent across all authorized routes, containing branding, settings access, and the global logout action.

## UI Elements
- **Branding**: Displays "PG pgbusinessflow.ai"
- **User Profile**: Displays the authenticated user's avatar, name, and email (if available).
- **Settings Dropdown**: A dropdown menu accessed via the Settings icon containing:
  - **Developer Mode Toggle**: A switch to enable/disable advanced technical features across the app.
  - **Logout Button**: Triggers session termination securely via AuthContext.

## Dependencies
- `lucide-react`: Settings, LogOut, Code, User icons.
- `AuthContext`: Utilizes the `useAuth` hook for `user` profile data and `logout()` function.
- `DeveloperModeContext`: Utilizes `useDeveloperMode` to globally toggle the developer state.
