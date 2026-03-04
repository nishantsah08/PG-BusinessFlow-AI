# Change Log: SystemObservationPanel

## Creation
- **Action**: Extracted transparent sub-panels from `ControlPanel.jsx` into a tabbed, overlapping card layout.
- **Reason**: To improve UX by reducing scrolling and providing a cleaner interface.
- **Impact**: Added a toggle logic to expand/collapse the sidebar, shifting layout responsibilities to this component instead of having them inline in `ControlPanel.jsx`.
