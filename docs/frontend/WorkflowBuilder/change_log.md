# WorkflowBuilder Change Log

**Version 1.0.0**
- Date: 2026-02-26
- Change: Initial module creation.
- Reason: Needed a form to create and edit workflow definitions, with dynamic step management and JSON parameter editing.

**Version 1.1.0**
- Date: 2026-02-26
- Change: Refactored UI for Natural Language view. Removed "Add Step", added "Developer Mode" collapsible triggers, and displayed `name` and `description` natively.
- Reason: Phase 8 and Phase 9 transition to Agent-First architecture where technical fields are hidden from standard users.

**Version 1.2.0**
- Date: 2026-02-26
- Change: Removed Preview Mode, Manual Override, and Trigger Settings UI. Added visible description textarea (required). Reworded trigger to explain 3 mechanisms (event, timer, MasterAI decision). Removed `validation_rules` entirely — validations are now regular workflow steps. Developer mode toggle moved to code icon in step header. Workflow name displayed in proper case.
- Reason: Simplify workflow builder, elevate description as the primary field for MasterAI workflow selection, and remove redundant validation_rules concept.
