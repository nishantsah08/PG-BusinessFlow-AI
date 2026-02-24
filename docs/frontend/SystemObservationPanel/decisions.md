# Decisions: SystemObservationPanel

1. **Tabbed Layout**: Chose a tabbed, overlapping card UI over the previous vertically stacked layout to reduce vertical scrolling and declutter the user interface.
2. **State Management Lift-Up**: The toggle state (`isOpen`) is lifted up to `ControlPanel` so that the main `ChatPanel` can adjust its width dynamically based on whether the observation panel is visible. 
3. **Local State for Tabs**: The `activeTab` state remains local to `SystemObservationPanel` as it does not affect any sibling components or parent layout.
