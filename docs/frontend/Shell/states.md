# Shell States

- **Standard State**: The application Shell does not have variant states itself; however, it dynamically renders the active React Router page state.
- **Scroll Handling**: Forces `overflow-hidden` globally, passing the responsibility of internal scrolling (y-overflow) downwards to the individual page component injected by the Outlet.
