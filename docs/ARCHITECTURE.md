# Architecture

How the catalogue PoC is structured and why. Scope comes from the assessment brief and `docs/PRODUCT.md`. Rules in `.claude/rules/` are the enforced version of this document; where they overlap, the rules win.

## 1. Goals and constraints

| Source | Constraint | How the design answers it |
| --- | --- | --- |
| Brief | Client never calls Fake Store; all product data goes through our backend | Only `server/` knows the Fake Store host. `client/` talks to `/api` only (checked by `scripts/check-boundaries.mjs`). |
| Brief | Foundation, not a throwaway: data source, look and feel, email provider will change | Three seams, each changed in one place (section 8). |
| Brief | Runs locally in under 10 minutes, no paid accounts | `docker compose up` starts client, server and Mailpit. Config from `.env.example`. |
| Brief | AWS-compatible infrastructure, no secrets in the repo | Plain Dockerfiles, env-only config, Mailpit swapped for SES behind an interface. |
| Brief | Time-box 2 to 3 hours | Smallest structure that still keeps the three seams. No speculative layers. |

Non-goals: cart, checkout, accounts, admin, final branding, real product metadata.

## 2. Stack and why

| Layer | Choice | Reason |
| --- | --- | --- |
| Client | React 19, TypeScript, Vite, Tailwind, shadcn/ui | Web is the quickest to run and review. shadcn gives accessible parts we own as source, with tokens in one CSS file. |
| Backend | Node.js, TypeScript (strict), Express 5, zod | Same language as the client. Express is small and well known. zod validates every request at the edge and types the config. |
| Mail (local) | Mailpit over SMTP | Free, no signup, shows the sales email in a web UI. |
| Packaging | Docker Compose, nginx serves the client and proxies `/api` | One origin for the browser, one command to run. |
| Tests | Vitest in both packages, Testing Library on the client | Same runner everywhere, tests run with no network. |

## 3. System context

```
 Browser
    |  one origin (http://localhost:8080)
    v
 client container  (nginx: static React app, proxies /api)
    |  HTTP JSON
    v
 server container  (Express)
    |------------------------------> ProductProvider  --> Fake Store API (adapter)
    '------------------------------> Mailer           --> SMTP --> Mailpit (adapter)
```

Dependencies point one way: client -> server API -> providers. Nothing points back.

## 4. Boundaries

- `client/` and `server/` share no imports. The shared shapes are the API contract (section 6), written down once and mirrored by types on each side.
- `client/` makes every server call through one module, `client/src/lib/api.ts`. Components never use `fetch`.
- Inside `server/`: **routes -> services -> providers**. A route never calls a provider. A provider never imports a route or service. Services depend on interfaces, not concrete classes.
- Business rules (search, top rated, category grouping, pagination, enquiry email content) live in services, so they survive a provider swap.
- Providers are selected by config at startup in one composition root.

## 5. Server structure

```
server/src/
  index.ts            start-up: load config, build providers, build app, listen
  config.ts           zod-validated env, fails fast with a clear message
  app.ts              Express app, CORS to CLIENT_ORIGIN only, error handler
  routes/             thin: validate input, call a service, shape the response
  services/           catalogue service, enquiry service
  domain/             Product, ProductProvider, Mailer, typed errors
  providers/
    fakestore/        ProductProvider adapter: URLs, field names, mapping, error mapping
    smtp/             Mailer adapter
```

`domain/` is the only place providers and services both import from.

### Domain types

```ts
// What the app knows about a product. Not the upstream shape.
interface Product {
  id: string | number
  title: string
  price?: number
  image?: string
  category?: string
  description?: string   // used for search and the detail page
  rating?: number        // used only to rank "top rated"; not sent to the client
}

interface ProductProvider {          // everything the app needs from a catalogue
  list(): Promise<Product[]>
  getById(id: string): Promise<Product | null>
  listCategories(): Promise<string[]>
}

interface Mailer {                   // deliver only; content is built in the service
  send(message: MailMessage): Promise<void>
}

// domain/mail.ts. replyTo is the customer, so sales can answer from the inbox. `from` is adapter config.
interface MailMessage { to: string; subject: string; body: string; replyTo?: string }
```

Typed errors: `UpstreamError` (provider failed, timed out or returned malformed data), `NotFoundError`, `ValidationError`, `MailDeliveryError`. The error handler maps them to HTTP responses. Raw upstream errors and stack traces never reach the client.

### Featured products wiring (issue 3)

- `config.FEATURED_PRODUCT_IDS` (already split and trimmed in `config.ts`) is passed to the catalogue service at construction, not read by routes or the adapter.
- `index.ts` is the composition root: `createProductProvider(config)` -> `createCatalogueService({ provider, featuredIds })` -> `createApp(config, { catalogue })`. `createApp` takes the service, so route tests inject a fake one.
- `routes/products.ts` (thin): `GET /products/featured` calls `catalogue.getFeatured()` and maps each item to the wire `Product` (drops `description`, `rating`). Registered before `/products/:id` so `featured` is not read as an id.
- `getFeatured()`: `getById` per id, in configured order; `null` is skipped and logged; `UpstreamError` propagates (502).
- Mailer wiring is not part of this issue.

### Category endpoints wiring (issue 4)

Assumptions are in `docs/DECISIONS.md` (#4). Final contracts:

- `GET /api/categories` -> `200 string[]`, raw upstream names, provider order.
- `GET /api/categories/:category/products?page&pageSize` -> `200 { topRated: Product[], products: Product[], page, pageSize, total }`. Wire `Product` has no `rating` and no `description`. The endpoint is paged (see "Pagination wiring (issue 8)"). Unknown category -> `404 { error: { code: 'not_found', message: 'We could not find that.' } }`; a known empty category -> 200 with empty lists.

Server pieces:

- `domain/errors.ts`: re-add `NotFoundError` (message only). `routes/errorHandler.ts` maps it to 404 with `code: 'not_found'` and the generic message 'We could not find that.' (the client supplies its own copy per page; the server does not say whether a product or a category was missing). The log line stays. The handler also maps any error with `status === 400` (bad percent-encoding, bad JSON) to `400 { error: { code: 'bad_request' } }`.
- `services/catalogue.ts` adds to `CatalogueService`:
  - `listCategories(): Promise<string[]>` passes through `provider.listCategories()`.
  - `getCategoryPage(category, { page, pageSize })` (paged in #8; shape in "Pagination wiring (issue 8)"). Steps: `listCategories()`, exact case-sensitive match, else `throw new NotFoundError`; then `provider.list()`, filter `p.category === category`, sort, `topRated = sorted.slice(0, TOP_RATED_COUNT)`, `rest = sorted.slice(TOP_RATED_COUNT)`, then page `rest`. `TOP_RATED_COUNT = 3` is a constant in this file.
  - Ranking lives here only, using `rating` from the domain `Product`: rating descending, missing last, ties by id ascending with numeric-aware `localeCompare`. The service returns domain `Product`s.
- Routes (layering unchanged: route -> service):
  - `routes/products.ts` keeps `/products/featured` and `/products/:id` (added in #6, registered after `/products/featured`).
  - New `routes/categories.ts` exports `categoriesRouter(catalogue)` with both category routes; `app.ts` mounts it under `/api`. It validates the path and paging query, calls the service and maps items through `toCard`. Paging fields come from the service (#8).
  - New `routes/wire.ts` exports `toCard(product): WireProduct` (picks `id, title, price, image, category`). `products.ts` and `categories.ts` both use it, so the "no rating or description on the wire" rule has one home. Replace the inline map in `products.ts`.
- Param validation (zod, in the route file, before the service call; failure -> `ValidationError` -> 400):
  - `category`: `z.string().trim().min(1).max(64)`. Express has already decoded it. No character whitelist; it is only compared against the provider list.
  - Product id schema: see "Product endpoint wiring (issue 6)". It replaces the earlier `min(1).max(32)` plan.
- Tests: service against a fake provider (top 3 order, missing rating last, tie order, unknown category throws `NotFoundError`, empty category); route tests for 200 shape with no `rating`, 404 shape, 400 on empty/over-long category, 502 on `UpstreamError`.
- Client: `api.ts` gains `getCategories()` and `getCategoryPage(category, page?)` (applies `encodeURIComponent`; `page` sent only when above 1). No other module calls `fetch`.

### Search endpoint wiring (issue 5)

Assumptions are in `docs/DECISIONS.md` (#5). Final contract:

- `GET /api/products?q=term&page&pageSize` -> `200 { products: Product[], page, pageSize, total }`. Wire `Product` via `toCard` (no `description`, no `rating`). The endpoint is paged. No match -> 200 with an empty list, not 404.
- Invalid `q` (missing, empty or whitespace-only, over 100 chars after trimming) -> `400 { error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { q: '<message>' } } }`, the shared shape from section 6. Suggested `fields.q`: "Enter a word to search for." (empty) and "Use 100 characters or fewer." (too long). `bad_request` is only for unreadable requests.
- Route (`routes/products.ts`): `router.get('/products', ...)` registered next to `/products/featured`. They do not collide (different paths); `/products/:id` (added in #6) goes after `/products/featured`. Zod schema in the route file: `z.string().trim().transform(s => s.replace(/\s+/g, ' ')).pipe(z.string().min(1).max(100))`. On failure the route throws `ValidationError({ q })` with the message above; the route never calls a provider.
- Service: `CatalogueService.search(term, { page, pageSize })` (paged in #8; it was `search(term): Promise<Product[]>`). Calls `provider.list()`, keeps products where `title` or `description` lowercased `.includes` the lowercased term, in provider order, no ranking. It receives the already-normalised term and pages the matches. Search stays in the service so it works with any provider.
- Route shapes the response: `{ ...result, products: result.products.map(toCard) }` (paging fields come from the service since #8).
- Tests: service against a fake provider (title match, description match, case-insensitive, provider order, no match -> `[]`); route tests (200 shape without `description`/`rating`, 400 with `fields.q` for missing, empty, whitespace and 101 chars, whitespace collapsed before matching, 502 on `UpstreamError`).
- Client: `api.ts` gains `searchProducts(q)`. It builds the query string with `URLSearchParams` inside `request()`; since #8 it also takes `page` (sent only when above 1). `SearchBar` (which uses `encodeURIComponent` to build the `/search?q=` URL) and `SearchPage` are client-side only: they navigate and fetch through `api.ts`. `RootLayout` reads `q` so the header field shows the current term.

### Product endpoint wiring (issue 6)

Assumptions are in `docs/DECISIONS.md` (#6).

- `GET /api/products/:id` -> `200 ProductDetail` = `{ id, title, price?, image?, category?, description? }`. No `rating`.
- Id schema (now in `routes/schemas.ts`, shared with the enquiry route): `z.string().regex(/^[\w-]+$/).max(64)`, not trimmed (a padded id is a 400, per `DECISIONS.md`; the earlier `.trim()` here was stale). The regex rejects empty, `.`, `..`, `/` and `%`, which matters because the Fake Store adapter puts the id in a URL path. Failure -> `ValidationError({ id: 'That product link is not valid.' })` -> `400 validation_failed`. Not digits-only, so another provider's id format still works.
- Service: `CatalogueService.getProduct(id): Promise<Product>` calls `provider.getById(id)`; `null` -> `throw new NotFoundError(...)` -> `404 { error: { code: 'not_found', message: 'We could not find that.' } }`. `UpstreamError` propagates (502).
- `routes/wire.ts` gains `toDetail(product): WireProductDetail` next to `toCard` (`toCard` fields plus `description`; still no `rating`). `description` is omitted from the JSON when absent. The "what goes on the wire" rule stays in this one file.
- Registration order in `routes/products.ts`: `/products/featured`, then `/products`, then `/products/:id`.
- Tests: service (found; `null` -> `NotFoundError`); route (200 shape has `description` and no `rating`, 400 for `..`, `a.b` and 65 chars, 404 shape, 502); `toDetail` drops `rating`.
- Client: `getProduct(id)` already exists in `api.ts`. `ProductPage` passes `sendEnquiry` from `api.ts` to `EnquiryForm` as `onSubmit` (see `docs/design-gaps.md`).

### Enquiry endpoint wiring (issue 7)

Assumptions and review fixes are in `docs/DECISIONS.md` (#7). Docs only here; nothing below exists yet.

**Contract.** `POST /api/enquiries`, `Content-Type: application/json`:

```ts
// request (EnquiryPayload from contract.md, plus the honeypot)
{ name: string, email: string, message: string, phone?: string,
  product?: { id: string | number, title?: string, price?: number },  // title, price ignored
  website?: string }                                                   // honeypot, sent only when non-empty, read before validation
```

| Outcome | Status and body |
| --- | --- |
| Sent (or honeypot hit) | `201 { "status": "sent" }` |
| Invalid field | `400 { error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields } }`, keys among `name`, `email`, `phone`, `message`, `product` |
| Unreadable JSON | `400 bad_request` (existing handler mapping) |
| Body over 10 kb | `413 { error: { code: 'payload_too_large', message: 'That enquiry is too large. Shorten your message and try again.' } }` (new handler mapping for `err.status === 413`) |
| Unknown product id | `404 not_found` (existing generic message) |
| Product source down while checking the id | `502 upstream_unavailable` (existing) |
| Too many enquiries | `429 { error: { code: 'rate_limited', message: 'You have sent several enquiries. Try again in a few minutes.' } }` plus `Retry-After: <seconds>` |
| Email not delivered | `502 { error: { code: 'enquiry_not_sent', message: 'We could not send your enquiry. Try again in a moment.' } }` |

**Zod schema** (in `routes/enquiries.ts`; zod 4; strips unknown keys; messages are customer-facing and become `fields`, first issue per key):

```ts
const enquirySchema = z.object({
  name: z.string({ error: 'Enter your name.' }).trim()
    .min(1, 'Enter your name.').max(100, 'Use 100 characters or fewer.')
    .regex(/^[^\r\n]*$/, 'Enter your name on one line.'),
  email: z.string({ error: 'Enter a valid email address.' }).trim()
    .max(254, 'Enter a valid email address.')
    .pipe(z.email('Enter a valid email address.')),        // already rejects whitespace and line breaks
  phone: z.string({ error: 'Enter a valid phone number.' }).trim()
    .max(30, 'Use 30 characters or fewer.')
    .regex(/^[\d\s+().-]*$/, 'Use digits, spaces and + - ( ) only.')
    .transform((v) => v || undefined).optional(),          // blank counts as absent
  message: z.string({ error: 'Enter a message.' }).trim()
    .min(1, 'Enter a message.').max(2000, 'Use 2000 characters or fewer.'),
  product: z.object({
    id: z.union([z.string(), z.number()]).transform(String).pipe(idSchema),
  }, { error: 'That product is not valid.' }).optional(),
})
```

The route runs `enquirySchema.safeParse(req.body ?? {})` and throws `ValidationError(fields)` on failure. Limits count UTF-16 units after trimming. The client mirrors none of them; the server is the authority.

**Order of checks** (each short-circuits; cheapest and most abusive-traffic-facing first):

1. `app.ts` CORS middleware: sets the `CLIENT_ORIGIN` header and answers `OPTIONS` with `204`, `Access-Control-Allow-Methods: GET, POST`, `Access-Control-Allow-Headers: Content-Type`. Preflights are not rate-limited.
2. Rate limiter (counts every POST, valid or not, so junk and oversize bodies cost a slot) -> `429`.
3. `express.json({ limit: '10kb' })`, registered on this route only -> `413` / `400 bad_request`.
4. Honeypot: `typeof req.body?.website === 'string' && req.body.website.trim() !== ''` -> log `enquiry honeypot hit ip=<ip>`, return `201 { status: 'sent' }`, no mail, no upstream call.
5. Schema validation -> `400`.
6. Service: product lookup via the catalogue -> `404` / `502 upstream_unavailable`.
7. Service: build the email, `mailer.send` -> `502 enquiry_not_sent`.
8. `201 { status: 'sent' }`, only after step 7 resolved.

The route is `router.post('/enquiries', limiter, express.json({ limit: '10kb', strict: false }), handler)`; arrays and scalars are treated like a missing body. The honeypot check is a request-shape guard (like validation), not a business rule, so it lives in the route; the service never sees bot traffic. The client sends `website` only when it is non-empty and does not short-circuit: the server's `201` decides, so bot hits reach the server and are logged.

**Rate limiter notes.** In memory per process (lost on restart). Idle keys are pruned at most once per window, not on every request. The key is the IP with IPv6 grouped on the /64 prefix and IPv4-mapped addresses read as IPv4; a malformed ip is kept as is. A mail failure is logged once, in the error handler (masked email and product id).

**Server pieces** (layering unchanged: route -> service -> provider):

- `domain/mail.ts`: `Mailer`, `MailMessage` (above). `domain/errors.ts` gains `MailDeliveryError(message, { cause })`, same shape as `UpstreamError`. Its message is fixed text; it never contains customer data.
- `services/enquiry.ts`: `createEnquiryService({ mailer, catalogue, salesEmail })` returns `{ submit(input) }`. `catalogue` is typed `Pick<CatalogueService, 'getProduct'>`. `input` is `{ name, email, phone?, message, productId? }`, already validated.
  - With `productId`: `catalogue.getProduct(id)` (throws `NotFoundError` or `UpstreamError`), and the email uses the provider's title and price.
  - Plain-text body (no HTML): a product line (`Product: <title> (id <id>), USD <price>`, or `No product`), `Name`, `Email`, `Phone` (or `Not given`), then `Message:` and the text. Sanitising: `\r\n` becomes `\n` and other control characters are removed in the message; every single-line value (name, email, product title) and the subject collapse control characters and line breaks to a space.
  - Subject `Enquiry: <title> from <name>` (`Enquiry from <name>` without a product), sanitised, cut to 150 characters. `to` is `salesEmail`, `replyTo` is the customer email.
  - `try { await mailer.send(...) } catch (cause) { log; throw new MailDeliveryError('Enquiry email not delivered', { cause }) }`.
  - Logs product id, masked email and, on failure, the error. `maskEmail` is a non-exported function in this file (`jo***@example.com`: first two characters of the local part, one if shorter), covered through the log output in the service test. No name, phone or message in any log.
- `providers/smtp/smtpMailer.ts`: `createSmtpMailer({ host, port, from })` using `nodemailer.createTransport({ host, port, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000 })`. `send` calls `sendMail({ from, to, replyTo, subject, text: body })`. It knows no enquiry content and wraps no errors. Only file that imports `nodemailer`.
- `providers/index.ts`: add `createMailer(config: Config): Mailer`, a `switch (config.MAIL_PROVIDER)` with one `'smtp'` case, next to `createProductProvider`. Same composition-root role, so no new module.
- `routes/enquiries.ts`: `enquiriesRouter(enquiry)`: the limiter, the body parser, the honeypot, the schema, one `enquiry.submit(...)` call, the `201`. Constants `LIMIT = 5` and `WINDOW_MS = 10 * 60_000` live here (they never vary, so not config).
- `routes/rateLimit.ts`: `createRateLimit({ limit, windowMs, now = Date.now })` returns an Express `RequestHandler`. State is a per-instance `Map<ip, number[]>` of hit times; each call drops expired entries (all keys, so the map cannot grow without bound), then either records the hit and calls `next()` or answers `429` with the shared body and `Retry-After` (seconds until the oldest hit expires, rounded up). It writes the 429 itself rather than throwing, because the error handler is for domain errors. It is HTTP middleware, so it sits in `routes/`; no `middleware/` folder for one file. Key is `req.ip`.
- `routes/schemas.ts`: `idSchema`, moved out of `products.ts`.
- `routes/errorHandler.ts`: add `MailDeliveryError` -> 502 `enquiry_not_sent`, and `err.status === 413` -> 413 `payload_too_large`. The existing log line stays (`req.path` only; it must not log the body).
- `config.ts`: `MAIL_FROM: z.email()` and `TRUST_PROXY_HOPS: z.coerce.number().int().min(0)`, both required (see section 10).
- `app.ts`: `createApp(config: Pick<Config, 'CLIENT_ORIGIN' | 'TRUST_PROXY_HOPS'>, services: { catalogue, enquiry })`; calls `app.set('trust proxy', config.TRUST_PROXY_HOPS)` first; the CORS middleware gains the `OPTIONS` branch; `app.use('/api', enquiriesRouter(services.enquiry))`. Existing `createApp` call sites in tests need the new config key and an `enquiry` service (use the helpers below).
- `index.ts` (composition root): `createEnquiryService({ mailer: createMailer(config), catalogue, salesEmail: config.SALES_EMAIL })`, passed to `createApp`.

**Infra.**

- `client/nginx.conf`: inside `location /api/`, add `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
- `docker-compose.yml`, `server.environment`: add `TRUST_PROXY_HOPS: 1` (it overrides the `0` from `.env.example`). `MAIL_FROM` comes from `.env.example`. Mailpit and `SMTP_HOST: mailpit` are already there.
- On AWS behind a load balancer in front of nginx, set `TRUST_PROXY_HOPS=2`; with a different count the limiter keys on the wrong address.

**Client** (details in `docs/design-gaps.md`, issue 7): `lib/enquiry.ts` adds `EnquiryError { fields?, message? }`; `sendEnquiry` in `api.ts` converts 400 `fields`, and the 429, 413 and `enquiry_not_sent` messages, into it and rethrows anything else as is; `EnquiryForm` shows `fields` beside the inputs (adding `phone`) and the message in the failure alert.

**Tests.** No new network and no real SMTP.

- `test/helpers.ts` gains `fakeMailer(failWith?: Error): Mailer & { sent: MailMessage[] }`: `send` pushes the message and resolves, or rejects with `failWith`. Mirrors `fakeProductProvider`. Also a `fakeEnquiry` or small `testApp(overrides)` helper so existing `createApp` call sites stay one line.
- Service (fake mailer and fake catalogue): body holds name, email, phone, message and the provider's title and price, not the client's; header values have no line breaks; control characters stripped; no product -> `No product`; unknown product -> `NotFoundError` and nothing sent; mailer rejection -> `MailDeliveryError` with the cause kept; logs contain the masked email and never the message.
- Route (real service, fake mailer, fake provider, real `listen(0)` as existing tests): 201 and one mail sent; 400 `fields` for each rule (name, email, phone, message, product, blank phone allowed); honeypot -> 201 and nothing sent; 404; 413 on an 11 kb body; 429 on the sixth request with `Retry-After` and no mail on the sixth; 502 `enquiry_not_sent` when the mailer fails; non-JSON body -> 400; `OPTIONS` preflight headers; a spoofed `X-Forwarded-For` does not change the key when `TRUST_PROXY_HOPS` is 0.
- Rate limiter unit test with a fake `now`: allows 5, blocks the 6th, allows again after the window, separate IPs do not share a bucket, `Retry-After` value.
- SMTP adapter test: `createSmtpMailer` takes an optional second argument, a nodemailer `Transporter`, so the mapping test passes `createTransport({ jsonTransport: true })` (builds the message, sends nothing) and asserts from, to, reply-to, subject and text; the error test points the default transport at a closed localhost port and asserts `send` rejects (the test network guard allows localhost). No real SMTP.
- Checking that the email reaches Mailpit (`http://localhost:8025`) is a manual step in `docker compose up`.

### Pagination wiring (issue 8)

Assumptions are in `docs/DECISIONS.md` (#8). Nice-to-have. No "ignored until #8" line remains above; both list endpoints read `page` and `pageSize`.

**Contract.**

| Endpoint | Success |
| --- | --- |
| `GET /api/categories/:category/products?page&pageSize` | `{ topRated, products, page, pageSize, total }`. `topRated` is the top 3 on page 1 and `[]` on page 2+. `products` is the page of the remainder. `total` is the size of the remainder. |
| `GET /api/products?q=&page&pageSize` | `{ products, page, pageSize, total }`; `total` is the match count. |

`GET /products/featured` and `GET /categories` are not paged.

**Schema** (in `routes/schemas.ts`, shared by both list routes, zod 4):

- `page`: digit string, integer, at least 1, default 1. `pageSize`: digit string, integer 1 to 50, default 12. A strict `/^\d+$/` string (not `z.coerce.number()`), so `1e1`, `0x10`, empty and repeated params (arrays) fail.
- Failure -> `ValidationError({ page?: 'Use a whole number from 1 to 1000000.', pageSize?: 'Use a whole number from 1 to 50.' })` -> `400 validation_failed`. Never clamped. `page` is capped at 1,000,000 so the offset arithmetic stays exact. On search these merge with the `q` message into one `fields`.

**Service.**

- One non-exported helper in `services/catalogue.ts`: `paginate(items, page, pageSize)` returns `{ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length }`. It knows nothing about products or providers.
- `getCategoryPage(category, { page, pageSize })`: after the 404 check, rank, `topRated = sorted.slice(0, 3)`, `paginate(sorted.slice(3), ...)`; returns `{ topRated: page === 1 ? topRated : [], products, page, pageSize, total }`.
- `search(term, { page, pageSize })`: filter in provider order, `paginate(matches, ...)`; returns `{ products, page, pageSize, total }`.
- Routes parse the query, call the service, map `topRated`/`products` through `toCard`. No slicing in routes, no counting in the client.

**Edge cases.**

- Page past the end: `200`, empty `products`, real `total`, never an error.
- A category with 3 or fewer products: page 1 has `topRated` and empty `products`, `total: 0`; page 2+ has both empty. The client treats `page > 1 && products.length === 0` as "That page does not exist.", and page 1 with both lists empty as the empty state.
- Order: validate paging first, then look up the category. Bad paging is `400` even for an unknown category; a valid page of an unknown category is `404` on any page.
- `pageSize` is echoed as requested, even if fewer items remain.

**Client.** `Pagination` (`components/Pagination.tsx`, app-level) takes `page`, `pageSize`, `total`, `to(page)`; it computes `totalPages = max(1, ceil(total / pageSize))` and renders nothing at 1. `CategoryPage` and `SearchPage` read `?page=` (sanitised to an integer >= 1, else 1), pass it to `api.ts`, key the content on term or category plus page, and wire `to`. `lib/usePagedFocus.ts` focuses the `h1` and scrolls to top when the location state is `{ paged: true }`, then clears that state (`navigate` with `replace`, state `null`) so reload and Back or Forward do not re-focus. Design details: `docs/design-gaps.md`, issue 8.

**Tests.** Service against a fake provider: page 1, page 2, past the end, `topRated` empty on page 2, 3-or-fewer category, search paging. Route: defaults, 400 for `0`, `-1`, `1.5`, `abc`, `1e1`, `pageSize=51`, repeated `page`, merged `q` and `page` errors, echoed `page`/`pageSize`. Client: Pagination hidden at one page, Previous/Next disabled at the ends, links carry `?page=`, page-past-end message, focus on the `h1` after a paged navigation.

### Service responsibilities

- **Catalogue service**: featured products (configured ID list, in that order), categories, category page (top rated first, then the rest, no duplicates), search, product by id, pagination.
- **Enquiry service**: builds the sales email (strips control characters from customer text; the body is plain text so no HTML is produced; strips newlines from header values), calls `Mailer`, converts a failure into `MailDeliveryError`. It never reports success if the email was not sent.

## 6. API contract

Read-only `GET` for catalogue data and one `POST` for enquiries. All under `/api`.

| Method and path | Purpose | Success response |
| --- | --- | --- |
| `GET /health` | Liveness | `{ "status": "ok" }` |
| `GET /products/featured` | Home page: the configured products, in configured order (five in `.env.example`) | `Product[]` (no `description`, no `rating`) |
| `GET /categories` | Category links | `string[]` |
| `GET /categories/:category/products?page&pageSize` | Category page. `topRated` is on page 1 only; `products` is the paged remainder and `total` counts only it | `{ topRated: Product[], products: Product[], page, pageSize, total }` |
| `GET /products?q=&page&pageSize` | Search, paged | `{ products: Product[], page, pageSize, total }` |
| `GET /products/:id` | Product details | `ProductDetail` |
| `POST /enquiries` | Enquire | `201 { "status": "sent" }` |

Response shapes:

- `Product` is the design-system shape from `design-system/contract.md`: `id, title, price?, image?, category?`. The server drops `rating` and `description` here.
- `ProductDetail` is `Product` plus `description?` (settled in `DECISIONS.md`; `contract.md` updated). `rating` is never sent.
- `topRated` is not paginated: it is sent on page 1 and is `[]` on page 2 and later. `products` holds the additional items and is paginated.

Errors share one shape and the right status:

```json
{ "error": { "code": "validation_failed", "message": "Check the highlighted fields.", "fields": { "email": "Enter a valid email address." } } }
```

| Status | When |
| --- | --- |
| 400 | Invalid body, query or path param (`fields` present), or an unreadable request such as bad percent-encoding (`bad_request`) |
| 404 | Unknown product or category (well-formed id/name the source does not know) |
| 413 | Enquiry body over 10 kb (`payload_too_large`) |
| 429 | Too many enquiries from one address (`rate_limited`, with `Retry-After`) |
| 502 | Product source failed (`upstream_unavailable`) |
| 502 | Enquiry email could not be delivered (`enquiry_not_sent`; customer is told it failed, nothing is reported as sent) |
| 500 | Anything unexpected, with a generic message |

Enquiry body (matches `EnquiryPayload` in `design-system/contract.md`): `name`, `email`, `message` required, `phone` optional, `product: { id }` optional (the server ignores `title` and `price` and uses the provider's). The server revalidates all of it: trimmed, length-limited, valid email. Exact schema, limits, check order and error bodies: "Enquiry endpoint wiring (issue 7)".

Search input is trimmed, whitespace-collapsed and limited to 100 characters; an empty term is rejected with `validation_failed` and `fields.q` (see Search endpoint wiring).

## 7. Client structure

```
client/src/
  lib/api.ts          the only place that calls fetch; typed, one error type
  lib/                format, enquiry types, other helpers
  components/ui/      shadcn components (the design system)
  components/         product-aware components (ProductCard, ProductGrid, CategoryNav, EnquiryForm, Pagination, ...)
  pages/              Home, Category, Search and Product (all done); each handles loading, error, empty. `ProductPage` (`/products/:id`) also holds the Enquire button and the enquiry dialog around `EnquiryForm`. `NotFoundPage` is the `*` catch-all
  index.css           design tokens as CSS variables, the only home of colours
```

- Pages compose design-system components and pass the API's `Product` straight in. No ranking, filtering or search in the client.
- `EnquiryForm` calls an injected `onSubmit` and knows nothing about email. The page wires it to `api.ts`, and it rejects when delivery fails so the form shows the failure notice.
- Every data view has three states: loading (placeholder cards, `aria-busy`), error (what happened, what to do), empty.
- Look and feel changes by editing the tokens in `index.css`. Components read tokens only.

## 8. The three seams

| What will change | Where the change lands | What must not change |
| --- | --- | --- |
| Product data source | New adapter in `server/src/providers/`, new `PRODUCT_SOURCE` value | Routes, services, client, API shape |
| Look and feel | `client/src/index.css` tokens (and the design-system spec) | Components, pages, logic |
| Email provider | New `Mailer` adapter, new `MAIL_PROVIDER` value | Enquiry service, routes, client |

Each is tested on its own: an adapter test for mapping and error handling, and service tests against fake providers.

### Product data source

The mock source is [Fake Store API](https://fakestoreapi.com/docs) (`/products`, `/products/:id`, `/products/categories`). Only `server/src/providers/fakestore/` knows its URLs, field names (`rating.rate`, `image`, ...) and failure modes. It maps them to `Product` and turns timeouts, non-2xx and malformed JSON into `UpstreamError`.

Any other source is a new folder under `providers/` that implements `ProductProvider`, plus one case in the composition root and one `PRODUCT_SOURCE` value. To keep that cheap:

- The interface speaks in `Product`, string ids and category names, never in upstream JSON.
- An adapter owns its own settings (like `FAKESTORE_BASE_URL`), added to `config.ts` and `.env.example` when that adapter is selected. Services never see them.
- Adapters return `null` for an unknown id and throw `UpstreamError` for any network or data failure. No raw upstream error reaches a service.
- Search, top rated, pagination and category grouping stay in the catalogue service, so they work unchanged on any source.
- Known ceiling: the service filters the result of `list()` in memory. That is fine for a catalogue of hundreds of items. For a large source, add optional `search` or paging methods to `ProductProvider` and push the filtering down, without changing routes or the client.
- Each adapter has its own test for mapping and error handling. Service tests use a fake provider and stay untouched.

## 9. Enquiry flow

```
EnquiryForm -> api.ts POST /api/enquiries
  route:   rate limit, parse, honeypot, validate (zod)   -> 429 / 413 / 400 on failure
  service: check product, build email (sanitised), call Mailer
  adapter: deliver over SMTP                        -> Mailpit locally
  success: 201 -> form shows "Thank you"
  failure: MailDeliveryError -> 502 -> form shows "Your enquiry was not sent..."
```

The email to sales contains the customer's name, email, phone, message and the product (id, title, price).

## 10. Configuration

All config is environment variables, read and validated once at start-up (`config.ts`). `.env.example` lists every variable with a safe placeholder.

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port |
| `CLIENT_ORIGIN` | The only origin allowed by CORS |
| `PRODUCT_SOURCE` | Which `ProductProvider` adapter to build (`fakestore`) |
| `FAKESTORE_BASE_URL` | Upstream base URL, used only by that adapter |
| `FEATURED_PRODUCT_IDS` | Comma-separated IDs for the home page, in display order (required, no code default; `.env.example` ships `1,2,3,4,5`). Five is the intent; the count is not enforced (see `DECISIONS.md`) |
| `MAIL_PROVIDER` | Which `Mailer` adapter to build (`smtp`) |
| `SMTP_HOST`, `SMTP_PORT` | SMTP target (Mailpit locally). The adapter is local only (`secure: false`, no auth); SES or authenticated SMTP needs `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` added |
| `MAIL_FROM` | Sender address on enquiry emails (required; `.env.example` ships `catalogue@example.com`). The customer is Reply-To, never From |
| `SALES_EMAIL` | Recipient of enquiries |
| `TRUST_PROXY_HOPS` | Number of reverse proxies in front of the server, for `req.ip` and the enquiry rate limit. `0` in `.env.example` (direct), `1` in compose (nginx), `2` behind a load balancer plus nginx |

## 11. Security basics

- Validate every request at the route boundary; trust nothing from the client.
- CORS allows `CLIENT_ORIGIN` only.
- Escape customer text in the email body and keep header values free of newlines (no header injection).
- Never log customer contact details in full. Log errors with enough context to debug.
- No secrets in the repo; `.env` is ignored.
- Upstream and mail errors are mapped to our own errors, so internals do not leak.
- `POST /enquiries` has a honeypot and a per-IP rate limit (5 per 10 minutes, in memory), a 10 kb body limit, and re-checks the product server-side (see "Enquiry endpoint wiring (issue 7)").

## 12. Testing strategy

- **Services**: unit tests against fake `ProductProvider` and `Mailer`. Cover featured order, category top-rated then rest without duplicates, search match and no match, pagination edges, enquiry success and failure.
- **Adapters**: tested separately with recorded or fake responses for mapping and error handling.
- **Routes**: validation, status codes, error shape.
- **Client**: what the user sees and does: loading, empty, error, form validation, thank-you.
- One end-to-end happy path: enquire on a product and assert the fake mailer received the product and contact details and the thank-you shows.
- Tests never use the network (`server/test/no-network.ts` enforces it).

## 13. Deployment path to AWS

The Dockerfiles and env-only config run on ECS or App Runner as they are. SES replaces Mailpit by adding a `Mailer` adapter and setting `MAIL_PROVIDER`. A managed catalogue replaces Fake Store by adding a `ProductProvider` adapter. No code outside the adapter and config changes.

## 14. Decisions

Settled in `docs/DECISIONS.md`: product detail fields, routing, top-rated size, caching, interface naming.
