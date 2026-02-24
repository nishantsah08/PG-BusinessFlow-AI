# Shell Decisions

- **Full Screen Immobilization**: The `body` is forced to `h-screen overflow-hidden` by the Shell. Only the internal `<main>` tags within individual pages are allowed to scroll. This preserves the absolute positioning required for complex dashboards (like ReactFlow maps).
