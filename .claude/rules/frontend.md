---
paths:
  - "client/**"
---

# Frontend

- React with TypeScript, strict mode.
- All server calls go through one API module. Components never use `fetch` directly.
- Every data-driven view handles three states: loading, error and empty.
- Keep styling separate from logic. Use a small set of design tokens (colours, spacing, fonts) in one place so branding can be swapped later.
- Build semantic, accessible markup: real buttons and links, labelled form fields, alt text on images.
- Show form validation errors next to the field, and show a clear thank-you state after a successful enquiry.
- No business rules in components. Ranking, filtering and search are done by the server.
