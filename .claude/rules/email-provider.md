---
paths:
  - "server/**"
---

# Email provider

The email provider will be replaced. Keep it replaceable.

- Define a `Mailer` interface with one operation for sending a message (to, subject, body).
- Put each provider's code in its own adapter. Select the adapter by config.
- The default adapter must work locally with no paid account or external signup.
- Build the enquiry email content in the service layer, not in the adapter. Adapters only deliver.
- The sales recipient address comes from config.
- A send failure must surface as a typed error so the API can tell the customer it failed. Never report success if the email did not send.
- Escape or sanitise all customer-supplied text before putting it in an email body.
