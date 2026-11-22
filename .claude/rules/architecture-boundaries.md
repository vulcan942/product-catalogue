# Architecture boundaries

Layout: `client/` (UI), `server/` (API and business logic). Dependencies point one way: client → server API → providers.

- `client/` talks only to the `server/` HTTP API. It never calls the product data source or the email provider.
- `client/` and `server/` share nothing at import level. Shared shapes live in the API contract, not in cross-imports.
- Inside `server/`, layers are: routes → services → providers. A route never calls a provider directly, and a provider never imports a route or service.
- Providers are chosen by configuration at startup. Services depend on provider interfaces, not concrete classes.
