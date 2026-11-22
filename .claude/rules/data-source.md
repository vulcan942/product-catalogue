---
paths:
  - "server/**"
---

# Product data source

The product data source (currently Fake Store API) will be replaced. Keep it replaceable.

- Define a `ProductProvider` interface in the server's domain layer. It exposes what the app needs (list, get by id, list categories), not what the upstream API happens to return.
- Put all knowledge of the upstream API in one adapter. That includes its URLs, response shape and field names.
- The adapter maps upstream data into our own `Product` type. Nothing outside the adapter sees upstream field names.
- Upstream failures (timeouts, non-2xx, malformed data) become our own typed errors, never raw upstream errors.
- Search, "top rated" and category logic belong in the service layer, so they keep working with any provider.
- The featured-products list (5 product IDs) is configuration, not code in the adapter.
