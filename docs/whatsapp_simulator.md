# WhatsApp Simulator

## Objective

Use the WhatsApp simulator to test the inbound and outbound WhatsApp path without using the real provider.

## HTTP endpoints

```text
POST   /api/simulator/whatsapp/send
GET    /api/simulator/whatsapp/thread?phone=<E164 phone>
DELETE /api/simulator/whatsapp/thread?phone=<E164 phone>
```

## Expected use

```text
1. Clear a phone thread
2. Send a synthetic inbound WhatsApp message
3. Read the thread back
4. Confirm:
   - inbound event was recorded
   - CommunicationsAI normalized the message
   - MasterAI processed the event
   - outbound assistant reply was recorded
```

## Example payload

```json
{
  "from": "+919811111111",
  "body": "Hi, I need a room in Koramangala."
}
```

## Notes

- `from` should be a valid E.164 phone number.
- The simulator thread is the debugging source of truth for WhatsApp test messages.
- Simulator observability timestamps must follow the same IST timestamp rule as the rest of the system.
