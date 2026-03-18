# Preprod Reset

## Objective

Reset the shared development/pre-production environment to a clean application state.

## Run

From the project root:

```bash
./reset_preprod.sh --force
```

## What it resets

- Removes all non-default preprod tenant configs
- Blanks the default workspace owner state
- Deletes preprod CRM, HR, Property, and Finance data
- Removes tenant-scoped workflow variants
- Deletes preprod uploaded files under `prop/`, `artifact/`, `chat_upload/`, and `smoke-tests/`

## What it does not reset

- Firebase Auth users

Reason:
- Firebase Auth is shared at the project level, so deleting users here could affect other apps/sites.

## After running

Expected clean state:

```text
default tenant only
-> CEO email = null
-> CEO phone = null
-> owner name = null

system workflows kept
tenant workflows removed
tenant business data removed
preprod uploaded files removed
```
