---
name: add-provider
description: Add or swap a provider implementation, either the product data source or the email sender. Use when changing from Fake Store to another source, or from the local SMTP catcher to another email service.
---

# Add a provider

Providers are the swap points. Adding one must not touch routes, services or the client.

1. Read `docs/ARCHITECTURE.md` and `.claude/rules/data-source.md` or `.claude/rules/email-provider.md`.
2. Implement the existing interface (`ProductProvider` or `Mailer`) in a new file in the server's providers folder. Do not change the interface unless the new provider truly cannot fit; if so, stop and raise it with the architect.
3. Data source: map the source's fields to the normalised `Product` in `design-system/contract.md` inside the provider only. Map source errors to the server's own error type.
4. Email: build the sales email from the enquiry payload, escape user-supplied text, and keep header values free of newlines.
5. Register it in the one place that chooses providers by config, and add its settings to `.env.example` with no real secrets.
6. Test the adapter on its own: mapping and error handling, using recorded or fake responses. Never call the real service in tests.
7. Run the full suite. Confirm that no file outside the providers folder and the config changed.
