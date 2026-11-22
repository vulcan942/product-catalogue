---
paths:
  - "server/**"
---

# Backend API

- TypeScript, strict mode. Validate every request body, query and path param with a schema at the route boundary.
- Routes are thin: parse and validate, call a service, shape the response. No business logic in routes.
- Return consistent JSON error responses with the right HTTP status. Never leak stack traces or upstream error details to clients.
- Use plain read-only GET endpoints for catalogue data and a single POST for enquiries.
- Limit and trim search input length. Reject empty enquiry fields and invalid email addresses.
- Log errors server-side with enough context to debug. Never log customer contact details in full.
