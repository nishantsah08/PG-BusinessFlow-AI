# WhatsApp Live Test Runbook

## Purpose
Provide a repeatable, low-friction procedure to validate real WhatsApp ingress/egress through:
- Meta WhatsApp Cloud API webhook
- `CommunicationsAI` normalization + reliability checks
- `MasterAI` processing and outbound reply

## Preflight
In `server/.env`, confirm:
- `ALLOW_EXTERNAL_SEND=true`
- `WHATSAPP_TOKEN` is set
- `WHATSAPP_PHONE_NUMBER_ID` is set
- `WEBHOOK_VERIFY_TOKEN` is set
- `OPENAI_API_KEY` is set

Start backend:

```bash
cd server
npm run dev
```

Start tunnel (from repo root):

```bash
nohup ./.tools/ngrok/ngrok http 3001 --log=stdout > ./.logs/ngrok.log 2>&1 < /dev/null &
```

Confirm current public URL from ngrok logs, then set Meta webhook URL to:

```text
https://<your-ngrok-domain>/api/webhooks/whatsapp
```

Verify handshake:

```bash
curl -sS "https://<your-ngrok-domain>/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<WEBHOOK_VERIFY_TOKEN>&hub.challenge=12345" -w "\nHTTP:%{http_code}\n"
```

Expected:
- Body: `12345`
- Status: `HTTP:200`
- Backend log contains: `WEBHOOK_VERIFIED`

## Live Test Steps
1. Send `Hello` from a real WhatsApp test phone to the configured business number.
2. Wait for bot reply from `MasterAI`.
3. Send a second message (for context continuity), e.g. `Who do you think I am?`.

## Pass Criteria (Evidence)
From backend logs:
- `Incoming Webhook: received payload { object: 'whatsapp_business_account', entries: 1 }`
- `System Event Generated` with:
  - `event_type: "message.received"`
  - `context.channel: "whatsapp"`
  - normalized `payload.from` in E.164 format
- `MasterAI` processing line for same sender
- `CommunicationsAI` outbound `send_text_message`

From status webhooks:
- `Status Event Generated` with `event_type: "message.status"` and `status: "sent"`
- `Status Event Generated` with `status: "read"`

## Negative Control (Optional)
Post an old timestamp payload to webhook and confirm rejection:
- Expected code: `IS2_EXPIRED`
- Expected log: `Event rejected: Timestamp expired`

## Common Failure Patterns
- `HTTP:403` on handshake: wrong `WEBHOOK_VERIFY_TOKEN`.
- `SIMULATION` logs in `WhatsAppAdapter`: `ALLOW_EXTERNAL_SEND` is not `true`.
- No inbound events: Meta webhook not pointing to current ngrok URL.
- No outbound delivery/read statuses: provider-level issue or recipient availability.
