# Design gaps

Rulings on pieces the five features need that `design-system/README.md` does not list. Rule: compose first; a new component needs a reason the existing ones cannot cover. Issue 3 (home, featured products) and issue 4 (category page) are ruled on so far; later issues append here.

## SiteHeader

**Ruling: compose. No design-system component.** A small app-level `SiteHeader` in `client/src/components/` is plain markup, not a new design-system part.

- Markup: `<header>` containing one `<a>`/`<Link to="/">` with the brand text (plain text "Catalogue"; no logo, branding is pending). Styled with tokens only (`ink`, `t-heading-sm`, `border` hairline under it, `surface`). The link is at least 44px tall and shows the 2px focus outline.
- Props: none. It takes no `Product`.
- Scope in issue 3: brand link only. Category nav was deferred to the category-listing issue, because `GET /categories` did not exist yet and `product-scope.md` forbids endpoints and UI for later.
- Issue 4 added the nav to this header (done): built from `GET /categories` via `api.ts`, composed from `Button` (ghost) links (ruled in the issue 4 section below; `CategoryFilter` was deleted), with its own loading/error/empty handling. The search box was added in issue 5 (see below).
- Why not a new component: the README lists seven components for browsing content, and a page header is a layout wrapper with one link. Nothing in it needs a new token, state or glyph.

## PageContainer

**Ruling: compose. No `PageContainer` component.**

- Use one shared layout (the router's root element) that renders `SiteHeader` and `<main>` with the container classes: centred, max width `container-max` (1200px), horizontal padding `space-4` below 600px and `space-6` above. Pages render inside `<main>` and never set their own width. This gives one place for the width, which is all a wrapper component would give.
- Props: none (it is a class string on `<main>`, and the same on the header's inner row so the brand aligns with the content).
- Gap to fix: `container-max` is in `tokens.json` but not yet mapped in `client/src/index.css`. The frontend-builder maps it there (colours rule: tokens only live in `index.css`) rather than hard-coding `1200px` or `max-w-7xl`.
- Revisit: if a second place needs the same wrapper (header inner row plus main is two uses of one class string), extract a constant, not a component.

## Other pieces issue 3 needs (already covered, no new component)

| Piece | Ruling | Reason |
| --- | --- | --- |
| Section heading ("Featured products") | Compose: `<h2>` with `t-heading-md` | A styled heading tag; no behaviour. |
| Featured list | Compose: `ProductGrid` of `ProductCard` | Already has loading (placeholder cards, `aria-busy`) and empty states. Empty copy: "No featured products right now. Try browsing a category." Error state: `Notice` danger with what happened and what to do. |
| Card link to `/products/:id` | Compose: card title as a link inside `ProductCard` | `Enquire` stays the only action. If `ProductCard` has no link to the product page yet, the optional `renderTitle` prop on the title is a change to an existing component, not a new one (see request 3, resolved). The product page was built in issue 6 (see below). |
| Home hero | Not needed | `t-display` is allowed but optional. Skipped: no requirement. |

## Designer requests (issue 3, for the architect)

No new components needed. Two changes to existing pieces and one question. All three **resolved**.

All changes below are made by the frontend-builder in `client/src/components/` (where `ProductGrid` and `ProductCard` live; `design-system/` holds the spec, tokens and docs only). Update the component's entry in `design-system/README.md` props when the props change.

1. **`ProductGrid` fixed copy. Resolved: compose (change existing component).**
   - Add optional props `errorTitle`, `errorBody`, `emptyTitle`, `emptyBody` (all `string`). Current text is the default in each, so other pages are untouched. Home passes the copy from `docs/design.md`.
   - Reason: four strings, no new markup or state. A wrapper component or a `Notice` rendered by the page would duplicate the status branching `ProductGrid` already owns.
2. **`onEnquire` on home. Resolved: keep `onEnquire` required; home navigates.**
   - `HomePage` passes `(p) => navigate(`/products/${p.id}`)` using react-router's `useNavigate`. `ProductCard` and `ProductGrid` signatures do not change for this.
   - Reason: an optional `onEnquire` would allow an `Enquire` button that does nothing, or hide it, and then "Enquire" is no longer on every card. Navigating keeps `Enquire` the only product action and the card needs no knowledge of routing. When the enquiry issue lands, the product page opens the form; home does not change.
3. **Title link. Resolved: render-prop, router-agnostic.**
   - `ProductCard` gets optional `renderTitle?: (product: Product) => ReactNode`. Inside the existing `<h3>` it renders `renderTitle(product)`, defaulting to `product.title`. `ProductGrid` gets the same optional prop and passes it to each card.
   - Home passes `(p) => <Link to={`/products/${p.id}`}>{p.title}</Link>`. The card never imports react-router and still takes only `Product`.
   - Link styling (in the card, so every page gets it): the `<h3>` keeps the two-line clamp; the link is a block with `min-h-11` and `items-center` for the 44px tap area, `ink` text, underline and `accent` colour on hover, 2px `focus` outline with 2px offset. Only the title is a link, never the whole card, because the card holds the `Enquire` button.
   - Reason: a plain `href` prop would force a full page reload in a client-routed app; a render-prop is the smallest way to stay router-agnostic. This is a change to an existing component, not a new one.

**Router.** `react-router` (v7, single `react-router` package, `createBrowserRouter`) is confirmed, as in `DECISIONS.md`. It is not yet in `client/package.json`; the frontend-builder adds it and states the justification (four pages, `Link`, `useNavigate`, `Outlet`). It is free, needs no account and is acceptable under `security-config.md` and `CLAUDE.md` ("no new libraries without asking" is satisfied by this ruling plus `DECISIONS.md`). No other routing or data library is approved.

## Issue 4 (category page)

### SectionHeading

**Ruling: compose. No component.** Same as the issue 3 row: a styled `<h2>` with `t-heading-md`. Used for "Top rated" and "More in this category" (each only when its list is not empty, per `DECISIONS.md`). The page title is an `<h1>` with the category name (first letter uppercased via CSS, not `capitalize`). Three uses of one tag plus a class; a component would add no behaviour. If the class string repeats on three pages, share a constant, not a component.

### Category nav (header and home)

**Ruling: compose. One app-level component in `client/src/components/`, `CategoryNav`, no new design-system part.**

- Markup: `<nav aria-label="Categories">` with a `<ul>` of `Link`s (react-router) to `/categories/${encodeURIComponent(name)}`. Links are styled with the existing `Button` `variant="ghost"` via `asChild` (or the same classes), at least 44px tall, 2px focus outline with 2px offset, first letter uppercased (`first-letter:uppercase`). Wraps onto several rows; no horizontal scroll, no menu, no animation.
- Data: it calls `api.getCategories()` itself and owns loading (a short text or placeholder), error (`Notice` danger, one line, what happened and what to do) and empty (renders nothing). One fetch per mount: the header and home each mount it, which is two calls to a cheap endpoint; no shared cache or context (no caching decision). If that bothers you later, lift the fetch into `RootLayout`; not now.
- The current page is marked with `aria-current="page"` on its link.
- Why one component, not two: the header and the home "Browse categories" list differ only by heading and layout, so `CategoryNav` takes only optional `className` and `heading` (see the issue 4 designer requests, resolved).
- Why not a new design-system component: it is a list of links; nothing needs a new token, state or glyph.

### CategoryFilter.tsx

**Ruling: delete it.** It is unused, and it does the wrong job:

- It derives categories from loaded `Product[]`, which conflicts with the rule that the server list wins (conflict 3 below) and with the "no filtering in the client" rule in `frontend.md`.
- It is a toggle group with `onChange` and an "All" option, so it filters in place. We navigate to a category URL instead, which needs links, not toggles, for correct semantics (back button, shareable URL, screen readers announce links).
- Done: the file is deleted. `design-system/contract.md` line 29 ("Category chips come from the distinct `category` values of the products you load, plus an All chip") now reads: category links come from `GET /categories` (done in `contract.md`). `README.md` does not name `CategoryFilter`, so only that line changes. Chip tokens stay available; nothing else in the design system moves.

### Category page structure

**Ruling: compose. `CategoryPage` in `client/src/pages/` from existing parts.**

- `<h1>` category name, then, in order: `<h2>` "Top rated" + `ProductGrid` (when `topRated` non-empty), `<h2>` "More in this category" + `ProductGrid` (when `products` non-empty).
- Loading: one `ProductGrid` in loading state. Error: `ProductGrid` error state with default copy. Empty (both lists empty): one `ProductGrid` with `emptyTitle`/`emptyBody` set to "No products in this category yet. Try another category."
- Unknown category (API 404): `Notice` with "We could not find that category. Choose one from the menu." The page distinguishes it by the `api.ts` error type (status 404), not by parsing messages. No new component.
- Cards use the same `renderTitle` link and `onEnquire` navigation as home (ruled above). No sorting or filtering controls. Pagination controls are ruled in "Issue 8".
- Route: `/categories/:category` in `routes.tsx`; the param is decoded by react-router before use.

### Designer requests (issue 4, for the architect)

No new components. Two requests, both **resolved** with one optional prop.

1. **Heading owned by `CategoryNav`. Resolved: accept `heading?: string`.**
   - With `heading` set, `CategoryNav` renders a wrapper `<div className>` holding `<h2 id={useId()}>{heading}</h2>` and the `<nav>`. `HomePage` drops its own `section` and `h2` and passes `heading="Browse categories"`. The header passes none, so it renders only the `<nav>`.
   - Empty state renders nothing at all (wrapper, heading and its outer spacing included), so no heading over an empty list. The heading shows in loading, ready and error states, same as "Featured products" on home. `className` goes on the outermost element rendered.
   - Reason: the component already knows when it is empty; the parent does not. One prop, no callback.
2. **Duplicate landmark name. Resolved: no `label` prop; derive it.**
   - With `heading` set, the nav uses `aria-labelledby` pointing at the `h2` (name "Browse categories"). Without it, `aria-label="Categories"`. The two navs are then distinctly named from the one prop in request 1.
   - Reason: a second prop would only restate the heading text and could drift from it.

The nav error copy ("Categories did not load" / "Refresh the page to try again.") and the unknown-category tone (info `Notice`, not danger) are design choices in `docs/design.md`, not requests.

## Issue 5 (search)

### SearchBar

**Ruling: compose. One app-level `SearchBar` in `client/src/components/`, no new design-system part.** The design system (README, `design-system.json`) does not list a SearchBar. `Input`, `Label` and `Button` already exist in `client/src/components/ui`, and a search form is those three in a `<form role="search">`. The design-system `Field` (label, hint, error) covers the inline error.

- Props: `defaultValue?: string` (the current term on the results page) and optional `className`. It takes no `Product`. It uses react-router's `useNavigate` and on submit navigates to `/search?q=${encodeURIComponent(term)}`; it never calls the API. The results page does the fetch.
- Markup: `<form role="search">`, a `Label` "Search products" (`sr-only`, because the adjacent "Search" button and the `search` landmark make the purpose visible; it is still a real `<label>`, never placeholder-only), `Input type="search"` (44px min height, 16px text), submit `Button` "Search" (44px). Field and button in one row; the field takes the remaining width.
- Validation: on submit the client trims; if empty it does not navigate and shows an inline error under the field, "Enter a word to search for." (`aria-invalid`, `aria-describedby` to the message). Length is bounded with `maxLength={100}` on the input; no separate over-long message client side. Server rules remain the source of truth; the client does not collapse whitespace or match anything.
- Why not a new design-system component: it needs no new token, state or glyph. If the enquiry form's field pattern is later factored into `Field`, SearchBar uses it, nothing else changes.

### Placement in SiteHeader

**Ruling: compose. `SearchBar` is a third child of `SiteHeader`, on every page.**

- Below 960px: brand, then `CategoryNav`, then `SearchBar`, stacked (header is already `flex-col`). From 960px: one row, brand, nav, and the search bar pushed right with `min-[960px]:ml-auto`. Nav wraps rather than scrolls, as ruled in issue 4. Search is not on the header's first row on narrow screens; stacking keeps every target at least 44px with no horizontal scroll.
- On `/search` the header bar shows the current term via `defaultValue` read from `useSearchParams`; the bar is keyed on the term so it resets on a new search.
- Home and category pages do not get a second search box.

### Results page structure

**Ruling: compose. `SearchPage` in `client/src/pages/` from existing parts.** Route `/search` in `routes.tsx`.

- `<h1>` `Results for "term"`, then one `ProductGrid` of `ProductCard`, with the same `renderTitle` link and `onEnquire` navigation as home and category.
- Loading, error and empty are `ProductGrid` states (`frontend.md`). Empty copy: `emptyTitle` "No products match "term"", `emptyBody` "Try a different word or browse a category." Error uses the default copy. No new component.
- Missing or empty `q` in the URL (someone opens `/search` directly): no request; show a `Notice` info "Enter a word to search for." with no grid. A 400 with `fields.q` from the server (an over-long term, only reachable by editing the URL) shows a destructive `Alert` titled "Search did not run" with the server's `q` message (for example "Use 100 characters or fewer."). Other errors, and a 400 without `fields.q`, keep the generic "Products did not load" `ProductGrid` error state. The client trims only; the server collapses whitespace.
- `document.title`: `Search - Catalogue`. A result count is not shown (no requirement).
- Pagination controls are ruled in "Issue 8". No sort or filter controls.

## Issue 6 (product page)

The design system (`README.md`, `design-system.json`) has no `ProductDetail` component, so it is composed. All rulings: compose, no new design-system part.

### ProductDetail layout

**Ruling: compose in `client/src/pages/ProductPage.tsx`. No `ProductDetail` component.** One page uses it; a component with one caller adds a boundary for nothing.

- Fetches with `getProduct(id)` from `api.ts` and owns loading, error (retry) and not-found states, as the other pages do.
- Ready state: a "Back to products" `Link` to `/` (README label), then a two-column block from 600px (image well left, text right; one column below). Image well is the `ProductCard` one (`bg-muted`, contained, never cropped). Text column: category as a `Link` to `/categories/${encodeURIComponent(category)}` (`t-caption`, hidden when missing), `<h1>` title, price (`t-price`, hidden when missing, `formatPrice`), `description` in a `<p>` (`t-body`, hidden when missing), then the `Enquire` `Button`.
- `Enquire` is the default (primary) `Button`: it is the one action on this page, and the README reserves secondary for cards. The dialog's `Send enquiry` is also primary, but the dialog covers the page, so there is never a competing primary.
- Links use the 44px tap area and 2px focus outline classes already used in `NotFoundPage` and the card title link.

### Enquire dialog and focus return

**Ruling: compose `Dialog` (already in `components/ui`) around `EnquiryForm`.**

- `DialogTrigger asChild` wraps the `Enquire` button, so Radix returns focus to it on close with no code of ours. `DialogTitle` "Enquire about {title}" is required for the accessible name; no `DialogDescription` unless Radix warns.
- `onCancel` closes the dialog (focus returns to `Enquire`). Escape and the close button do the same.
- Conflict found: the form's success state shows a "Back to products" button that calls `onDone`. Closing the dialog would leave the person on the same page under a button with the wrong label. Ruling: `onDone` navigates to `/` (the label stays true) and the dialog unmounts with the page. No change to `EnquiryForm`.
- Pass `product` to `EnquiryForm` so it shows the product summary and prefills the message. Do not pass `description` or anything else; it takes only `Product`.

### Injecting onSubmit

**Ruling: `ProductPage` imports `sendEnquiry` from `lib/api.ts` and passes it as `onSubmit`.** `EnquiryForm` still only knows the injected `SubmitEnquiry` type, so it stays provider-agnostic; the page is the one place that wires it (`ARCHITECTURE.md` section 7). No context, no prop drilling beyond one level, since only this page opens the form. Until #7 adds `POST /enquiries` the form shows its honest "Enquiry not sent" error, as in `DECISIONS.md`.

### Image fallback

**Ruling: do not extract yet.** The fallback is a four-line `useState` plus an `onError` and a "No image" span in `ProductCard`, and the detail page needs a larger well with different sizing. Duplicate it in `ProductPage` (second use). Extract an `ImageWell` only if a third place needs it, matching the `renderTitle` rule above. Copy must stay identical: alt is the product title, fallback text is "No image".

### Back link and category link

**Ruling: compose with `Link`.** One "Back to products" to `/` and the category as a link; no breadcrumb component and no history tricks (the user's browser Back button already returns them to the search or category they came from, which `/` would not).

### Not-found state

**Ruling: compose inside `ProductPage`; do not reuse `NotFoundPage` as a component.** It says "This page does not exist.", which is wrong for a product. `ProductPage` shows an info `Alert`/heading "We could not find that product." with body "It may have been removed. Browse the catalogue to find something else." and the same "Go to the catalogue" link style as `NotFoundPage`. Trigger: `error instanceof ApiError && (status === 404 || (status === 400 && fields?.id))`; the person cannot tell these apart. Other errors (network, 5xx) use an error state with a "Try again" button (a real `<button>`, 44px) and the sentence "Product did not load. Check your connection and try again." `document.title` per `DECISIONS.md`.

### Designer notes (issue 6, for the architect, no new component)

Not blockers. Handled or recorded as follows.

1. **Dialog scrim and width are not tokens.** `components/ui/dialog.tsx` uses `ink` at 50% opacity for the scrim and a stock maximum width (`sm:max-w-lg`). `tokens.json` has no overlay or dialog-width token. Accepted as is for the PoC; add a token only if branding needs to change them.
2. **Dialog close button size.** The stock close button uses `size="icon"`; Verified: it reaches 44px, so no change.
3. **Success state inside the dialog.** The title still reads "Enquire about {title}" after the send. Accepted (recorded, no change): it is the dialog's name, and the success `Alert` plus "Back to products" carry the message.
4. **The catch-all `NotFoundPage` and Home have no `h1`.** Still open on purpose.

## Issue 7 (enquiry and sales email)

**Ruling: no new component.** `EnquiryForm` already has the thank-you state, the failure `Alert`, the honeypot and per-field `FieldError`. Three small changes to the existing form and `lib/`, all composing parts already there.

1. **Server field errors. Compose: reuse `FieldError`.** On a 400 with `fields`, show each message beside its input through the existing `FieldError`, `aria-invalid` and `aria-describedby`, and focus the first invalid field (same order as client validation). Gap found: the form has no error slot for `phone`, which the server can reject. Add `phone` to the `Field` type, `FIELD_ORDER` (name, email, phone, message), a `phoneRef` and a `FieldError`. No new component, no change to the "Phone (optional)" label. If none of the returned fields is visible (for example `product`), show the failure alert instead.
2. **Failure and 429 message. Compose: existing destructive `Alert`, same place** (above the buttons, inside the form; it already announces itself with `role="alert"`). Title stays "Enquiry not sent". The description is the server's message for 429 ("You have sent several enquiries. Try again in a few minutes."), 413 and `enquiry_not_sent` ("We could not send your enquiry. Try again in a moment."); every other failure keeps "Your enquiry was not sent. Check your connection and try again." (from the design README). A rate-limited customer sees a message that says what happened and what to do, which the generic "check your connection" would not.
3. **How the form learns the message. Keep it delivery-agnostic.** `contract.md` says `onSubmit` rejects when delivery fails and the form knows nothing about the provider. The form must not import `ApiError` or `api.ts`. Add `EnquiryError { fields?: Record<string, string>; message?: string }` to `lib/enquiry.ts`; `sendEnquiry` converts the API error into it; the form checks `instanceof EnquiryError` only. Any other rejection is the generic failure. Add one sentence to the `contract.md` `onSubmit` paragraph: "A rejection may be an `EnquiryError` carrying `fields` or a `message` to show." No other design-system change.
4. **Thank-you state. No change.** "Enquiry sent" with "Thank you. We will reply by email." and "Back to products" already meets "the customer will see a Thank you message". Success is shown only after `onSubmit` resolves, which the server does only after the email was handed to the mailer.
5. **Not needed:** a toast, a rate-limit page, a spinner component (the button already reads "Sending…" and is disabled), a captcha. The honeypot stays hidden and `aria-hidden`.

## Issue 8 (pagination)

### Pagination control

**Ruling: compose. One app-level `Pagination` in `client/src/components/Pagination.tsx`, no new design-system component, no new dependency.** The design system lists no pagination part. It is two `Button`s and a text label around react-router `Link`, which already exist; it needs no new token, state or glyph. It takes numbers and a URL builder, not a `Product`, so the "components accept only `Product`" rule (which is about product components) is not touched.

- Props: `page`, `pageSize`, `total` (numbers) and `to(page: number): string`. It derives `totalPages = max(1, ceil(total / pageSize))`, which is arithmetic, not a business rule. It renders nothing when `totalPages <= 1`.
- Markup: `<nav aria-label="Pagination">` holding Previous, a `<span>` "Page X of Y", and Next. Layout: one row, label between the buttons, one row is expected at 320px (estimated about 266px of 288px, not verified in a browser) and it wraps with `flex-wrap` at large text sizes.
- Enabled control: `<Button asChild variant="secondary"><Link to={to(page ± 1)} state={{ paged: true }} rel="prev|next">Previous|Next</Link></Button>`. A real link, 44px tall from `Button`, 2px focus outline from `Button`.
- Disabled control (page 1 Previous, last page Next): **a real `<button disabled>`** (`Button` with `disabled`), not a link with `aria-disabled`. Reason: a disabled button is out of the tab order, cannot be activated, is announced as unavailable, and `Button` already gives it the design-system disabled look (`surface-muted` fill, `ink-muted` text). A link without `href` has no role and is skipped by assistive tech; a link with `aria-disabled` stays focusable and clickable unless extra code blocks it. It stays in the layout so the row does not jump.
- Copy: "Previous", "Page 2 of 5", "Next". Sentence case, no icons needed.

### Focus and scroll after a page change

**Ruling: compose, with one small hook.** The clicked link unmounts when the page remounts (content is keyed on category or term plus page), so keyboard focus would fall to the document. `lib/usePagedFocus.ts` returns a ref for the page `h1` (`tabIndex={-1}`). On mount, if `useLocation().state?.paged` is true, it focuses the `h1` and calls `window.scrollTo(0, 0)`. The hook clears the state after use (`navigate` with `replace`, state `null`), so a reload or Back or Forward does not re-focus. Direct loads and reloads have no state, so nothing moves. Both `CategoryPage` and `SearchPage` use it, which is why it is a hook rather than copied code. The `h1` is rendered in every state (loading, error, ready), so the ref is always set on mount. No `aria-live` region: focusing the heading announces the change. Do not add a focus ring style to the `h1`: browsers do not match `:focus-visible` for programmatic heading focus after a click, and the heading is not a control.

### Page past the end

**Ruling: compose from the existing `Alert` (info), no new component.** When `page > 1 && products.length === 0`, show the `h1` plus an info `Alert` "That page does not exist." and a "Go to the first page" link (`Button asChild variant="secondary"` around a `Link`, 44px) to `to(1)`. The test is `page > 1` and empty `products`, not `total > 0`: for a category with 3 or fewer products `total` is 0 on every page, so `total > 0` would show the wrong message (see `DECISIONS.md`). `Pagination` is not rendered in this state. Page 1 with nothing to show remains the existing empty state.

### Placement

- `Pagination` goes below the paged grid: on a category, below "More in this category" (not under "Top rated"); on search, below the results grid. It is not shown in loading, error, empty or past-the-end states.
- The category page shows "Top rated" on page 1 only (the server returns `topRated: []` after that). The client already hides a section when its list is empty, so no client change. On page 2+ the "More in this category" heading remains.

### Not needed

Page-size selector, page-number list, "first/last" buttons, infinite scroll, a total-results count, `aria-live` region. None is in the acceptance criteria; Previous and Next with "Page X of Y" covers it.

## Conflicts found

1. **`server/src/config.ts` still enforces five ids** (`.length(5, ...)`). `docs/DECISIONS.md` says the count is not enforced and blank entries are ignored. Resolution: backend-builder removes the `.length(5)` pipe (keep split, trim, filter blanks) and updates `config.test.ts`. `ARCHITECTURE.md` now matches `DECISIONS.md`.
2. **`design-system/contract.md` had no `description`** but `GET /products/:id` returns it. Resolved in issue 6: `contract.md` now defines `ProductDetail`.
3. **`ProductGrid` contract says category chips come from loaded products** (`contract.md`), but the API serves `GET /categories`. Resolution for the category issue: the server list wins, the client does not derive categories. Not needed for issue 3.
4. **Server `Product.id` is `string`, contract allows `string | number`.** Compatible: the server only emits strings.
5. **Issue 8 draft discriminated "page past the end" by `total > 0`.** Wrong for categories with 3 or fewer products. Resolved: `page > 1 && products.length === 0` (`DECISIONS.md`, `ARCHITECTURE.md`).
