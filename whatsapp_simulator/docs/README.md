# WhatsApp Simulator Docs

Codex can change this simulator however it likes to make it functional if it breaks during testing.

## Purpose
- Provide a thin internal GUI to simulate inbound WhatsApp messages for testing.
- Route simulator messages through the existing backend webhook processing path.
- Show inbound/outbound message thread for a selected phone number.

## Run
- Backend app should be running at `http://localhost:3001`.
- Start simulator:
  - `cd whatsapp_simulator`
  - `npm start`
- Open `http://127.0.0.1:5281`.

## APIs Used
- `POST /api/upload/images`
- `POST /api/simulator/whatsapp/send`
- `GET /api/simulator/whatsapp/thread?phone=...`
- `DELETE /api/simulator/whatsapp/thread?phone=...`

## Scope
- Test-only utility.
- Not production customer UI.
