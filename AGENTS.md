# AGENTS.md

## Documentation Change Policy (`@docs`)

All changes to files in `docs/` must follow these rules:

1. Keep changes minimal.
2. Get explicit user confirmation before making any change.
3. Make only strategic changes aligned to clear project goals.
4. Avoid broad rewrites, stylistic churn, or non-essential edits.
5. If a proposed update is large, split it into small confirmed steps.

## Execution Standard

For any requested `docs/` update:

1. Propose the smallest viable change.
2. Explain why it is strategically necessary.
3. Wait for user confirmation.
4. Apply only the confirmed scope.

## Communication Preference

When presenting analysis, plans, or recommendations:

1. Prefer business-oriented language.
2. Keep explanations abstract where practical.
3. Frame decisions from a higher-level system viewpoint.

## CLI Usage Preference

1. Use the full terminal width/space effectively.
2. Avoid narrow, left-heavy output formatting when a wider layout improves readability.

## Startup Behavior

1. When Codex starts, read the `@docs` folder first.

## Change Completion Standard

1. Whenever new changes are made, identify and update related documentation with explicit user confirmation first.
2. Run tests according to the testing philosophy documented in `@docs` for the affected feature, and expand test scope when required.

## Architecture Clarification Policy

1. If any system architecture detail is missing or unclear, do not assume; ask the user for clarification first.
