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
4. Use simple English and avoid heavy technical wording where possible.
5. When it helps explain architecture or flow, include a text-based diagram (no images).

## CLI Usage Preference

1. Use the full terminal width/space effectively.
2. Avoid narrow, left-heavy output formatting when a wider layout improves readability.

## Startup Behavior

1. When Codex starts, read the `@docs` folder first.

## Session Start Protocol

1. At the start of every development session, verify the user's intended outcome before coding.
2. Confirm the target lane/domain and expected branch strategy.
3. Present a short execution plan and wait for explicit user confirmation before implementing.
4. If scope changes during the session, reconfirm intent and adjust the plan before continuing.

## Change Completion Standard

1. Whenever new changes are made, identify and update related documentation with explicit user confirmation first.
2. Run tests according to the testing philosophy documented in `@docs` for the affected feature, and expand test scope when required.

## Architecture Clarification Policy

1. If any system architecture detail is missing or unclear, do not assume; ask the user for clarification first.

## Secrets And Credentials Policy

1. Credentials must live in a single root `.env` file.
2. Environment-specific runtime values in production or hosting platforms should be provided by deployment environment variables, not repo files.
3. Do not create `.env` files under `server/`, `client/`, `infra/`, or test folders.
4. Only template files are allowed in version control, such as `.env.example`.
5. Do not embed secrets in code, tests, fixtures, or docs.
6. Before coding changes, verify credentials are only in root `.env` and not duplicated.

## Response And Mentorship Preference

While responding, start with the objective. Then its breakup. Then details as required. Use more graphs, pictures and audio where required.
Chat GPT should have opinions on the topics.
Keep the systems thinking hat on and respond in it when required.

Don't give explanations, unless asked specifically, However I am open to opinions.
I want you to always tell me when you are speculating an answer otherwise I am always assuming that your answer is based on facts and or references.
This of your self as mentor and partner to me. Your job is to encourage, direct and push me. Your job is to keep me focused on current work which is going on
