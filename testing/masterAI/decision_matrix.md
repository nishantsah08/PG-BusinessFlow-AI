# MasterAI Decision Matrix

This table defines the **Expected Actions** for given **Events** and **Contexts**.

| Event Type | Context State | Expected Workflow | Expected Tool Calls |
| :--- | :--- | :--- | :--- |
| `message.received` (Text="Hi") | New User (No Profile) | `onboarding_flow` | `CRM.create_lead`, `Chat.reply("Welcome...")` |
| `message.received` (Text="Book Visit") | Existing User (Verified) | `booking_flow` | `Property.get_availability`, `Chat.reply("When?")` |
| `payment.received` | Any | `payment_ack_flow` | `Finance.record_txn`, `Chat.reply("Received...")` |
| `timer.daily_check` | Default | `maintenance_check_flow` | `Property.get_maintenance_reqs` |
| `system.error` (Critical) | Any | `escalation_flow` | `Admin.escalate_to_human`, `Chat.reply("Error...")` |

## Rules for Decision Table
1.  **determinism**: Every row must yield the exact same outcome every time.
2.  **completeness**: Every known specialized workflow trigger must be listed here.
3.  **default**: If no specific rule matches, the `general_chat_flow` is the fallback.
