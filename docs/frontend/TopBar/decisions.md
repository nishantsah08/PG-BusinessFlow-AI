# TopBar Decisions

## Architecture Decisions
- **Absolute vs Relative Positioning**: The `TopBar` establishes the primary full-width flex container heading the application. It maintains `z-30` explicitly to float above any nested scroll views, ensuring high availability of the Logout/Settings actions.
- **Context vs Props**: The Logout function is aggressively pulled from `AuthContext` instead of passed as a prop from the Shell. This isolates the authentication concern solely to this component natively, reducing prop-drilling in the overarching layout component.
