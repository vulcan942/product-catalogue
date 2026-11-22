# Design

UI design for the catalogue PoC. Built only from `design-system/` components and the rulings in `docs/design-gaps.md`. Token names only; no raw colours, sizes or fonts.

Scope of this version: **issue 3 (home, featured products)**, **issue 4 (category nav and category page)**, **issue 5 (search bar and results page)**, **issue 6 (product page with the enquiry dialog)**, **issue 7 (enquiry form final state, server errors, sales email)** and **issue 8 (pagination on category and search)**. Other screens are added by later issues.

| Screen | Route | Status |
| --- | --- | --- |
| Home | `/` | Designed below |
| Category | `/categories/:category` | Designed below |
| Search results | `/search?q=` | Designed below (with the search bar) |
| Product detail | `/products/:id` | Designed below (Product page) |
| Enquiry form and thank-you | dialog on the product page | Designed below (Product page, then "Enquiry form (issue 7, final state)"). Sends through `POST /api/enquiries` (#7). |
| Not found (catch-all) | `*` | Designed below |

## App layout (shared by every page)

```
RootLayout (router root element)
  SiteHeader                                  no props
    header (border hairline below, surface)
      inner row (container classes)
        Link to="/"  "Catalogue"              t-heading-sm, ink
        CategoryNav                           see "Category nav" below
        SearchBar                             see "Search bar" below; below 960px on its own row under the nav
  main (container classes)
    <Outlet />                                the page
```

- Container classes (one shared string, per design-gaps): centred, max width `container-max`, horizontal padding `space-4` below 600px and `space-6` from 600px. The header inner row and `main` use the same string so the brand aligns with content.
- `main` vertical padding: `space-6` top and bottom below 960px, `space-8` from 960px.
- Brand link: at least `touch-target` tall, 2px `focus` outline with 2px offset, no underline change on hover beyond `accent` text. Text is "Catalogue". No logo. The category nav (issue 4) and search bar (issue 5) are the other two header children.
- Page background `surface`.
- Heading rule: each page has one `h1` except Home and the catch-all not-found page (open gaps, below; not fixed here). Sections are `h2`, card titles `h3`. The product page has an `h1` only (no `h2`) in its ready state.
- Document title: `Catalogue` by default; pages that set their own reset it on leave.
- Page-level shared parts used by the product page: `Link` (react-router) with the 44px tap area and 2px `focus` outline with 2px offset, `Alert` (`info`, `success`, `destructive`), `Button`, `Dialog`. No other new parts.

## Home

### Component tree

```
HomePage
  (inside RootLayout > main)
  section  aria-labelledby="featured-heading"
    h2 id="featured-heading"                  "Featured products"   t-heading-md, ink
    ProductGrid(products=featured, status, onEnquire, renderTitle, errorTitle, errorBody, emptyTitle, emptyBody)
      status "ready":   ul > li x N > ProductCard(product, onEnquire) x N
      status "loading": placeholder cards (aria-busy, aria-label "Loading products")
      status "error":   Notice (danger)
      empty:            Notice (info)
  CategoryNav heading="Browse categories"      same component as the header; renders its own h2
    div (className: top spacing)
      h2 id (useId)                             "Browse categories"   t-heading-md, ink
      nav aria-labelledby=h2 id                 own loading/error/empty
```

- "Browse categories" sits below the featured section, `space-6` below the grid below 960px and `space-7` from 960px (top spacing is on the `CategoryNav` wrapper via `className`). Heading to nav gap `space-4`. The heading shows in loading, ready and error; when the list is empty `CategoryNav` renders nothing (wrapper, heading and spacing), so there is no heading over an empty list. It does not depend on the featured status: if featured fails, categories still show.
- This makes the featured empty copy "Try browsing a category" true: the header nav and this block both link to categories.
- The `h2` is owned by `CategoryNav` via an optional `heading` prop, and names the nav through `aria-labelledby` (design-gaps, issue 4 requests 1 and 2, resolved).

- `N` is whatever `GET /products/featured` returns (five by default). The page never assumes five.
- Data: `HomePage` calls `api.ts` for featured products and passes the `Product[]` straight into `ProductGrid`. No sorting, filtering or slicing in the component.
- Heading level: the page has no `h1` in the header, so the section heading is the first heading. Use `h2` as ruled and keep it; the header brand is a link, not a heading. Open gap: the home page still has no `h1` (the category page has one). To be settled; recorded in `DECISIONS.md`.
- Spacing: `space-5` between cards (set by `ProductGrid`), `space-4` between the heading and the grid.

### ProductCard on home

Existing `ProductCard` anatomy, unchanged except the optional `renderTitle` prop (see design-gaps, request 3):

```
ProductCard(product, onEnquire, renderTitle?)
  image well (surface-muted; image contained; "No image" if missing or broken)
  category        t-caption, ink-muted
  h3 > renderTitle(product)    t-heading-sm, ink, up to 2 lines
                               home passes: Link to=/products/:id wrapping product.title
  price           t-price, via formatPrice
  Button variant="secondary" "Enquire"   (sr-only " about {title}")
```

- The title is the link to `/products/:id` (`product.id` as given). Hover shows an underline in `accent`; focus is the 2px `focus` outline with 2px offset. Do not make the whole card a link: the `Enquire` button sits inside it and nested interactive elements are invalid.
- `Enquire` is the only action. There is no cart, buy, wishlist or quantity UI.
- `onEnquire` on home: the product page holds the enquiry form, so `HomePage` passes a handler that navigates to `/products/:id` (built in #6). `onEnquire` stays required; the product page opens the form. Ruled in design-gaps, request 2 (resolved).
- Card chrome unchanged: `border` hairline, `shadow-card`, `shadow-raised` on hover, `radius-lg`, `space-4` body padding.

### States

| State | What the user sees |
| --- | --- |
| Loading | `h2` "Featured products" stays. `ProductGrid status="loading"`: placeholder cards in `surface-muted` (`radius-sm` bars), `aria-busy="true"`, accessible name "Loading products". No spinner, no animation. |
| Ready | Cards in configured order, linked to `/products/:id`. |
| Error | `h2` stays. In place of the grid: `Notice` danger with an alert icon, title "Featured products did not load", body "We could not reach the catalogue. Check your connection and refresh the page to try again." Title `t-label` in `danger`, body `t-body-sm` in `ink` on `danger-bg`, `radius-md`. Announced with `role="alert"`. |
| Empty | `h2` stays. `Notice` info with an info icon, on `surface-muted`. Title "No featured products", body "No featured products right now. Try browsing a category." (copy fixed in `DECISIONS.md`). |
| Partial | A configured id the server cannot find is skipped by the server, so the grid just shows fewer cards. No special UI. |

Notes:

- Retry is a hint, not a button: the copy tells the user to refresh. No new control, so nothing to add to the system.
- "Try browsing a category" is plain text, not a link. The header nav and the "Browse categories" block hold the links.
- The existing `ProductGrid` has fixed error and empty copy that does not match the above. Ruled in `docs/design-gaps.md` (request 1, resolved): optional `errorTitle`, `errorBody`, `emptyTitle`, `emptyBody` props on `ProductGrid`, with the current text as default.

### Responsive behaviour

Breakpoints: 600px and 960px only. Column count is not a breakpoint rule: `ProductGrid` fits as many columns as `card-min` allows.

| Width | Layout |
| --- | --- |
| Below 600px | One column of cards (a 220px minimum plus `space-4` page padding cannot fit two on common phones). Container padding `space-4`. Section top and bottom `space-6`. `h2` stays `t-heading-md`. Cards fill the width; `Enquire` is full width and at least `touch-target` tall. Error and empty notices fill the width. |
| 600px to 959px | Container padding `space-6`. Grid fits two to three columns by `card-min`, gap `space-5`. Section top and bottom `space-6`. |
| 960px and up | Full desktop spacing: `main` top and bottom `space-8`. Grid fits up to the `container-max` width, so four to five columns by `card-min`, gap `space-5`. |

- Five featured cards at `container-max` fit in one row or wrap to a second row of one or more cards; accepted, no special handling.
- Text never truncates except card titles, which clamp to two lines. Product prices and categories wrap.
- Touch: all interactive elements at least `touch-target` tall (brand link, title link tap area, `Enquire`).

### Accessibility

- Landmarks: `header` with `nav` "Categories", `main`, one labelled `section` (featured), and `nav` "Browse categories" (named by its heading).
- Order of tab stops per card: title link, then `Enquire`.
- Images: `alt` is the product title (existing). Missing or failed image shows the words "No image".
- Loading is announced through `aria-busy` and the label, error through `role="alert"`; state is never colour alone (icon plus title plus words).
- Focus ring is never removed.

### Copy

| Where | Text |
| --- | --- |
| Brand link | Catalogue |
| Section heading | Featured products |
| Card action | Enquire |
| Loading label (accessible only) | Loading products |
| Error title | Featured products did not load |
| Error body | We could not reach the catalogue. Check your connection and refresh the page to try again. |
| Empty title | No featured products |
| Empty body | No featured products right now. Try browsing a category. |
| Image missing | No image |

Plain, sentence case, no exclamation marks, no emoji, no sales words. Prices appear exactly as the data gives them, through `formatPrice`.

## Category nav

`CategoryNav` (app-level, `client/src/components/`, ruled in design-gaps issue 4). Used in the header on every page and in the home "Browse categories" block.

### Component tree

```
CategoryNav(className?, heading?)
  [heading set: div(className) > h2 "heading", nav aria-labelledby=h2]
  [no heading:  nav(className) aria-label="Categories"]
    status "ready":   ul > li x N > Link to=/categories/{encodeURIComponent(name)}
                        rendered as Button variant="ghost" asChild, aria-current="page" on the active one
                        text = category name, first letter uppercased (first-letter:uppercase)
    status "loading": div role="status" aria-busy="true" aria-label "Loading categories" > ul (aria-hidden) > li x 4 placeholder bars (surface-muted, radius-sm)
    status "error":   Notice (danger), one line
    status "empty":   renders nothing (no nav, no wrapper, no heading)
```

- Links: ghost `Button` (`accent` text, `t-label`), at least `touch-target` (44px) tall, horizontal padding `space-4`, 2px `focus` outline with 2px offset, `radius-md`. The active link has `aria-current="page"` and also shows an `accent-subtle` fill and underline, so it is not colour alone. Gap between links `space-2`.
- Names are shown as the server gives them (first letter uppercased only, never title case; "jewelery" is not corrected).
- Placeholder bars are the same height as a link (`touch-target`), no animation.

### States

| State | What the user sees |
| --- | --- |
| Loading | Four placeholder bars in `surface-muted`, `aria-busy="true"`, accessible name "Loading categories". Reserves the row height so the page does not jump. |
| Ready | One link per category from `GET /categories`, in server order. |
| Error | One-line `Notice` danger: title "Categories did not load", body "Refresh the page to try again." Announced with `role="alert"`. Brand link and page content still work. |
| Empty | Nothing rendered, including the home heading. |

### Placement and responsive

Wraps onto further rows; no horizontal scroll, no menu, no animation. Wrapping keeps every link at 44px with no hidden items.

| Width | Header | Home "Browse categories" block |
| --- | --- | --- |
| Below 600px | Brand link on its own row, nav on rows below it (`space-2` between). Container padding `space-4`. Links wrap as needed; the Notice fills the width. | Same wrap, links start at the left edge, `space-2` gaps. |
| 600px to 959px | Same stacked layout as below 600px; container padding `space-6`. | Same. |
| 960px and up | Brand and nav on one row: brand at the left, nav fills the rest and wraps if it must; vertically centred, `space-4` between brand and nav. | Same wrap. |

- Header padding: `space-3` top and bottom below 960px, `space-4` from 960px. Hairline `border` below, as before.
- Order of tab stops in the header: brand, then each category link.

Copy: Loading label (accessible only) "Loading categories"; error title "Categories did not load"; error body "Refresh the page to try again."; home heading "Browse categories".

## Category page

Route `/categories/:category`. Rendered inside `RootLayout > main`; the header nav shows the current category as active.

### Component tree

```
CategoryPage
  h1                                            category name, first letter uppercased (first-letter:uppercase), t-heading-lg (`--text-heading-lg` token, 28px) at every width
  status "ready", topRated non-empty:
    section aria-labelledby="top-rated-heading"
      h2 id="top-rated-heading"                 "Top rated"   t-heading-md, ink
      ProductGrid(products=topRated, status="ready", onEnquire, renderTitle)
        ul > li x N > ProductCard(product, onEnquire, renderTitle)
  status "ready", products non-empty:
    section aria-labelledby="more-heading"
      h2 id="more-heading"                      "More in this category"   t-heading-md, ink
      ProductGrid(products=products, status="ready", onEnquire, renderTitle)
  status "ready", total pages > 1 (issue 8):
    Pagination(page, pageSize, total, to)       sibling after the sections, see "Pagination (issue 8)"
  status "loading":
    ProductGrid(products=[], status="loading")
  status "error":
    ProductGrid(products=[], status="error")
  status "ready", page 1, both lists empty:
    ProductGrid(products=[], status="ready", emptyTitle, emptyBody)
  status "ready", page > 1 and products empty (issue 8):
    Alert (info) "That page does not exist." + Button secondary asChild > Link "Go to the first page"
  status "not-found" (API 404):
    h1 "Category not found" + Alert (info) with the body copy
```

- Data: `CategoryPage` calls `api.ts` for the category using the decoded `:category` param and passes the lists straight to `ProductGrid`. `topRated` and `products` never overlap (server guarantee); no sorting, filtering, slicing or de-duplication in the component.
- Each heading appears only when its own list is non-empty. A category with three or fewer products shows only "Top rated". "Top rated" is on page 1 only (the server sends `topRated: []` after that); "More in this category" stays on page 2 and later while `products` is non-empty. Page controls are specified in "Pagination (issue 8)" below. No sort or filter controls.
- `renderTitle` is a `Link` to `/products/:id`; `onEnquire` navigates to `/products/:id`, same as home.
- Spacing: `space-5` between `h1` and the first section, `space-6` between sections below 960px and `space-7` from 960px, `space-4` between a section heading and its grid.
- The `h1` is the first heading on this page (the header has no heading). Section headings are `h2`, cards `h3`.

### States

| State | What the user sees |
| --- | --- |
| Loading | `h1` shows the category name from the URL. Below it one `ProductGrid status="loading"`: placeholder cards, `aria-busy="true"`, name "Loading products". No section headings. |
| Ready | `h1`, then "Top rated" grid, then "More in this category" grid, each heading only with a non-empty list. |
| Error | `h1` stays. `ProductGrid` error `Notice` danger, default copy (title "Products did not load", body "Check your connection and refresh the page to try again.", the existing `ProductGrid` defaults). `role="alert"`. No section headings. |
| Empty | `h1` stays. `Notice` info, title "No products found" (default), body "No products in this category yet. Try another category." (copy from `DECISIONS.md`). No section headings. |
| Unknown category (404) | `h1` reads "Category not found"; below it an `Alert` (info) with the body "We could not find that category. Choose one from the menu." (copy from `DECISIONS.md`). The header nav and "Browse" links stay as the way out; no category is active. No product grid. |

Notes:

- The page tells 404 from other errors by the `api.ts` error type (status 404), not by message text.
- The unknown-category `Alert` uses the info tone, not danger: the site is working and the URL is wrong. Announced with `role="status"`. "Choose one from the menu" refers to the header category nav, which is on every page.
- Retry is a hint ("refresh the page"), no button.

### Responsive behaviour

Breakpoints: 600px and 960px only. Column count comes from `card-min`, not a breakpoint rule.

| Width | Layout |
| --- | --- |
| Below 600px | One column of cards. Container padding `space-4`. `h1` and `h2` at their token sizes. `Enquire` full width, at least `touch-target` tall. Notices fill the width. |
| 600px to 959px | Container padding `space-6`. Grid fits two to three columns, gap `space-5`. Section gap `space-6`. |
| 960px and up | `main` top and bottom `space-8`. Grid fits four to five columns up to `container-max`, gap `space-5`. Section gap `space-7`. |

- Card titles clamp to two lines; nothing else truncates. Long category names in the `h1` wrap.
- All interactive elements at least `touch-target` tall.

### Accessibility

- Landmarks: `header` with `nav` "Categories", `main`, one labelled `section` per non-empty list.
- The heading order is `h1`, `h2`, `h3`. Section headings are absent when the list is, so there is no heading over nothing.
- Active category link has `aria-current="page"`.
- Document title is the raw category name followed by " - Catalogue", set by the page and reset to "Catalogue" on leave.
- State is never colour alone.

### Copy

| Where | Text |
| --- | --- |
| Page title (h1) | Category name from the server, first letter uppercased by CSS |
| Section heading 1 | Top rated |
| Section heading 2 | More in this category |
| Card action | Enquire |
| Loading label (accessible only) | Loading products |
| Error title | Products did not load |
| Error body | Check your connection and refresh the page to try again. |
| Empty title | No products found (ProductGrid default) |
| Empty body | No products in this category yet. Try another category. |
| Unknown title | Category not found |
| Unknown body | We could not find that category. Choose one from the menu. |

## Search bar

`SearchBar` (app-level, `client/src/components/`, ruled in design-gaps issue 5). Third child of `SiteHeader`, on every page. Home and category pages do not get a second one. It never calls the API: it navigates to `/search?q=` and the results page fetches.

### Component tree

```
SearchBar(defaultValue?, className?)
  form role="search" noValidate
    div (row: field + button, gap space-2)
      Label htmlFor=id                       "Search products"   sr-only, t-label
      Input id type="search" name="q"        placeholder "Search products", maxLength=100,
                                             aria-invalid + aria-describedby only while the error shows
      Button variant="primary" type="submit" "Search"
    [error only] p id role="alert"           inline alert glyph + "Enter a word to search for."
```

- `Label` is a real `<label>` bound to the field and visually hidden: the `search` landmark and the adjacent "Search" button make the purpose visible. Never placeholder-only.
- Placeholder "Search products" repeats the label in `ink-muted` (holds 4.5:1 on `surface`); it vanishes on typing and is not relied on for the name.
- `Input`: at least `touch-target` (44px) tall, text `t-body` (16px, so mobile browsers do not zoom), `surface` fill, `border-control` border, `radius-md`, `space-3` padding. `Button` primary: at least `touch-target` tall, `t-label`, `accent` fill with `on-accent` text, `accent-hover` on hover, `radius-md`. Field takes the remaining row width; button is its natural width.
- Focus: 2px `focus` outline with 2px offset on both the field and the button, never removed. Field border stays `border-control` (3:1) when not focused.
- Native `type="search"` clear control may show; it is not restyled and not relied on. The form is `noValidate` so the browser's own bubble never replaces our message.

### Showing the current term

- On `/search`, `SiteHeader` reads `q` with `useSearchParams` and passes it as `defaultValue` (trimmed). The bar is keyed on the term, so a new search resets the field to the new term.
- On every other page the term is empty and the field is blank.
- The field is uncontrolled beyond that: what the user types is not synced to the URL until submit.

### States

| State | What the user sees |
| --- | --- |
| Idle | Label (sr-only), empty or prefilled field, "Search" button. |
| Empty or whitespace-only submit | No navigation, no request. The message "Enter a word to search for." appears under the field in `danger`, `t-body-sm`, with the alert glyph (20px, 2px stroke, `currentColor`) so it is not colour alone. The field border changes to `danger`. Focus stays in (or returns to) the field. |
| Error cleared | The message and `aria-invalid` are removed on the next edit of the field, or on a valid submit. |
| Over-long | `maxLength=100` stops typing at 100 characters. No separate message; paste is cut by the browser. |
| Valid submit | Navigates to `/search?q={encodeURIComponent(trimmed term)}`. The client trims only; it does not collapse whitespace or match anything. |

- Error association: the message `<p>` has an `id`; while it shows, the `Input` has `aria-invalid="true"` and `aria-describedby` set to that id. When it is gone both attributes are removed (no dangling reference). The message has `role="alert"` because it appears after a submit and must be announced; the field keeps focus so the name, invalid state and description are read together.
- The message is in normal flow under the field. From 960px the header grows by one line while it shows; nothing overlaps.

### Responsive behaviour

Breakpoints 600px and 960px only. The header inner row is `flex-col` below 960px and a single row from 960px.

| Width | Layout |
| --- | --- |
| Below 600px | Stacked: brand row, `CategoryNav` rows, then the search row. The search form fills the container width (padding `space-4`); field and button on one row, `space-2` apart. `space-2` gap between brand and nav as before, `space-3` between nav and search. No horizontal scroll: the field shrinks (`min-w-0`), the button never wraps. Error message wraps under the field. |
| 600px to 959px | Same stack; container padding `space-6`. Search form still fills the width. Header padding `space-3` top and bottom. |
| 960px and up | One row, vertically centred: brand at the left, `CategoryNav` takes the free space and wraps within it, `SearchBar` pushed to the right (`ml-auto`), kept from shrinking, with the field `card-min` wide plus the button. `space-4` between items. Header padding `space-4`. |

- Fit check: at the widest case (`container-max` minus `space-6` padding each side) brand, search (`card-min` field, `space-2`, button) and the nav fit on one row for the few categories the catalogue has. If the nav needs more room it wraps onto more rows inside its own column; the search bar stays on the right and the row grows taller. At 960px exactly the nav column is narrow and wraps sooner; accepted. No item is hidden, no scrolling, no menu.
- Tab order in the header: brand, each category link, search field, "Search".

### Copy

| Where | Text |
| --- | --- |
| Label (sr-only) | Search products |
| Placeholder | Search products |
| Button | Search |
| Empty-submit error | Enter a word to search for. |

## Search results page

Route `/search?q=`. Rendered inside `RootLayout > main`; the header search bar shows the term.

### Component tree

```
SearchPage
  h1                                  Results for "term"   t-heading-lg, ink, wraps (overflow-wrap anywhere)
  status "ready", results non-empty:
    h2 (sr-only)                      "Matching products"
    ProductGrid(products, status="ready", onEnquire, renderTitle)
      ul > li x N > ProductCard(product, onEnquire, renderTitle)
    Pagination(page, pageSize, total, to)             only when total pages > 1, below the grid (issue 8)
  status "loading":
    ProductGrid(products=[], status="loading")
  status "error":
    ProductGrid(products=[], status="error")          default copy
  status "ready", page 1, no matches:
    ProductGrid(products=[], status="ready", emptyTitle, emptyBody)
  status "ready", page > 1 and products empty (issue 8):
    Alert (info) "That page does not exist." + Button secondary asChild > Link "Go to the first page"
  q missing or empty (no request):
    h1 "Search products"
    Notice (info)
```

- Data: `SearchPage` reads `q` with `useSearchParams`, trims it, and calls `api.searchProducts(q)`. It passes the `Product[]` straight to `ProductGrid`. No matching, ranking, filtering or slicing in the component; the server returns provider order. One grid only, no sections, no sort or filter controls. Paging is specified in "Pagination (issue 8)" below; `q` and `page` both come from the URL.
- Cards: `renderTitle` is a `Link` to `/products/:id` and `onEnquire` navigates to `/products/:id`, same as home and category. `Enquire` is the only product action.
- `term` is the trimmed `q` shown as plain text (React escapes it), in straight double quotes.
- A result count is not shown (no requirement).
- Heading order: `h1`, then the sr-only `h2` (only when ready, so cards do not jump from `h1` to `h3`), then card `h3`. The header has no heading.

### States

| State | What the user sees |
| --- | --- |
| Loading | `h1` with the term. One `ProductGrid status="loading"`: placeholder cards in `surface-muted` (`radius-sm` bars), `aria-busy="true"`, name "Loading products". No spinner, no animation. No `h2`. |
| Ready | `h1`, then cards in server order, linked to `/products/:id`. |
| Error | `h1` stays. `ProductGrid` error `Notice` danger, A 400 with `fields.q` (for example an over-long term reached by editing the URL) shows a destructive `Alert` titled "Search did not run" with the server's `q` message as the body (for example "Use 100 characters or fewer."). Any other error, and a 400 without `fields.q`, shows the default copy: title "Products did not load", body "Check your connection and refresh the page to try again.". `role="alert"`. The client trims only; the server collapses whitespace. |
| Empty | `h1` stays. `Notice` info on `surface-muted`: title `No products match "term"`, body "Try a different word or browse a category." The header nav is the way to browse. |
| Missing or empty `q` | No request. `h1` reads "Search products". `Notice` info: title "No search term", body "Enter a word to search for." The header search box is the control. No grid. |

Notes:

- Retry is a hint ("refresh the page"), no button.
- Long term: the term is at most 100 characters after trimming (the bar's `maxLength`), but a URL can carry more; the `h1` and the empty-state `Notice` title both wrap (`overflow-wrap: anywhere`), never truncate and never cause horizontal scroll, at 320px as at desktop.
- A new search from the header changes `q`, which returns the page to loading for the new term; the `h1` and `document.title` follow.

### Responsive behaviour

Breakpoints 600px and 960px only. Column count comes from `card-min`, not a breakpoint rule.

| Width | Layout |
| --- | --- |
| Below 600px | One column. Container padding `space-4`. `h1` stays `t-heading-lg`, wraps over lines. `space-5` between `h1` and grid. `Enquire` full width, at least `touch-target` tall. Notices fill the width. |
| 600px to 959px | Container padding `space-6`. Grid fits two to three columns, gap `space-5`. |
| 960px and up | `main` top and bottom `space-8`. Grid fits four to five columns up to `container-max`, gap `space-5`. |

### Accessibility

- Landmarks: `header` with `nav` "Categories" and `search` (the form), then `main`.
- Document title: `Search - Catalogue`, set by the page and reset to "Catalogue" on leave. It does not include the term.
- Loading through `aria-busy` and the label, error through `role="alert"`, empty and missing-term notices as `role="status"`. State is never colour alone (icon, title and words).
- Tab order after the header: title link, then `Enquire`, per card.

### Copy

Straight double quotes around the term. Sentence case, no exclamation marks.

| Where | Text |
| --- | --- |
| Page title (h1) | Results for "term" |
| Page title, no term | Search products |
| Sr-only section heading | Matching products |
| Card action | Enquire |
| Loading label (accessible only) | Loading products |
| Error title | Products did not load |
| Error body | Check your connection and refresh the page to try again. |
| Error title, 400 with `fields.q` | Search did not run |
| Error body, 400 with `fields.q` | The server's `q` message, for example "Use 100 characters or fewer." |
| Empty title | No products match "term" |
| Empty body | Try a different word or browse a category. |
| No-term title | No search term |
| No-term body | Enter a word to search for. |
| Document title | Search - Catalogue |

## Pagination (issue 8)

Applies to the category page and the search results page. Ruled in `docs/design-gaps.md` (issue 8): composed from `Button` and react-router `Link`, no new design-system component. The URL is the state: `?page=N` on both routes, page 1 omits the param.

### Pagination control

`Pagination(page, pageSize, total, to)` (app-level, `client/src/components/Pagination.tsx`). Takes numbers and a URL builder, never a `Product`.

```
Pagination(page, pageSize, total, to)            renders nothing when totalPages <= 1
  nav aria-label="Pagination"
    Previous:
      page > 1:   Button variant="secondary" asChild > Link to={to(page - 1)} state={{ paged: true }} rel="prev"
                    "Previous" + span.sr-only " page"
      page = 1:   Button variant="secondary" disabled   (real <button disabled>)
                    "Previous" + span.sr-only " page"
    span                                          "Page {page} of {totalPages}"   t-label, ink
    Next:
      page < totalPages: Button variant="secondary" asChild > Link to={to(page + 1)} state={{ paged: true }} rel="next"
                    "Next" + span.sr-only " page"
      page = totalPages: Button variant="secondary" disabled
                    "Next" + span.sr-only " page"
```

`totalPages = max(1, ceil(total / pageSize))` (arithmetic only).

- Targets: both buttons use the stock `Button` size: at least `touch-target` (44px) tall and wide, `t-label` text, `radius-md`, `border-control` border on `surface`, hover to the next tone. Focus is the 2px `focus` outline with 2px offset, from `Button`, never removed.
- Disabled: a real `<button disabled>` at the ends, `surface-muted` fill with `ink-muted` text (README disabled rule). It is out of the tab order, not activatable and announced as unavailable. Enabled and disabled use the same `Button` size and the same text, so the row does not jump and Previous and Next keep their place.
- Accessible names: visible text stays short ("Previous", "Next"); the name is completed with visually hidden text, "Previous page" and "Next page". Chosen over `aria-label` because it is the pattern `Enquire` already uses (`sr-only` " about {title}"), it is read from the DOM, and it cannot drift from the visible text. Name-in-label holds: the accessible name starts with and contains the visible text. The disabled buttons keep the same hidden text, so a screen reader says "Previous page, dimmed" or "unavailable".
- Label: `span` "Page 2 of 5", `t-label`, `ink`, at least `touch-target` tall so it centres with the buttons. Not a link, not focusable.
- Hidden when `totalPages <= 1`: nothing rendered, including the `nav` and its top spacing. No "Page 1 of 1".
- No icons, page-number list, first/last, page-size selector, count or `aria-live` region (design-gaps, "Not needed").

### Spacing and alignment

| Where | Token |
| --- | --- |
| Gap above the control (from the grid or the last section) | `space-6` below 960px, `space-7` from 960px. On the category page it is the existing section gap, so the control behaves like one more block in the page stack. On search it is the same pair. |
| Gap between Previous, label and Next | `space-3` below 600px, `space-5` from 600px |
| Bottom | None extra; `main` bottom padding (`space-6`, `space-8` from 960px) applies |

- Alignment: one row, vertically centred (`items-center`). Below 600px the row fills the container width with Previous at the left edge, Next at the right edge and the label between (`justify-between`), so the targets are at the screen edges and easy to hit. From 600px the row is centred under the grid (`justify-center`), buttons close to the label.
- Fit at 320px: container padding is `space-4` each side, so 288px of content. "Previous" (`t-label` plus `space-4` side padding), "Page 10 of 10" and "Next" are estimated at about 266px of the 288px with `space-3` gaps, so the three items should fit on one row. This is an estimate and is not verified in a browser. If a user's own text size makes them not fit, the row wraps (`flex-wrap`, `space-3` row gap) in source order: Previous and the label on the first row, Next on the second, never clipped and never a horizontal scroll. Accepted; not a layout we draw.
- The label's width changes with the digits ("Page 9 of 12" to "Page 10 of 12"), which can shift the buttons by a few pixels when centred from 600px. Accepted; the below-600px layout is stable because the buttons are at the edges.

### Responsive

Breakpoints 600px and 960px only.

| Width | Layout |
| --- | --- |
| Below 600px | Full-width row, Previous left, Next right, label between, `space-3` gap. Above it `space-6`. |
| 600px to 959px | Centred row, `space-5` gap. Above it `space-6`. |
| 960px and up | Centred row, `space-5` gap. Above it `space-7`. |

### Placement

- Category page: after the "More in this category" section, as a sibling in the page stack (not inside "Top rated", not inside the section). It is shown when `total` gives more than one page. Page 1 of a category with three or fewer products has `total` 0, so no control.
- Search page: directly below the results grid.
- Not rendered while loading, in error, in an empty state, in the not-found state, or past the end. The control never shows without cards above it.
- Tab order: after the last card's `Enquire`, Previous (or skipped if disabled), Next.

### Page change: loading, focus, scroll, announcement

- A click on Previous or Next changes the URL; the page content remounts (keyed on category or term plus page) and goes to loading: `ProductGrid status="loading"` placeholder cards, `aria-busy="true"`, name "Loading products". The `Pagination` control disappears during loading (not rendered until ready), and the section headings are absent as in any loading state. The `h1` stays.
- Focus: the clicked link is gone after the remount, so `usePagedFocus` (design-gaps, issue 8) focuses the `h1` (`tabIndex={-1}`) and scrolls to the top when `location.state.paged` is true. The hook then clears the state (`navigate` with `replace`, state `null`). Direct loads, reloads, new searches and category links carry no state, so focus and scroll do not move.
- The `h1` is the same text on every page (category name, or `Results for "term"`), so it does not say which page. The announcement is the heading being focused plus the loading region (`aria-busy`, "Loading products"); the new "Page X of Y" label is read when the user tabs to the control. No `aria-live` region.
- Focus ring on the focused `h1`: no ring is styled. Decision: add no outline style and do not suppress the browser's. Reasons: the heading is not a control and README's "never remove it" is about interactive elements; browsers match `:focus-visible` for a script-focused heading only after keyboard use, so a keyboard user gets the browser's own cue of where focus went and a mouse user sees no stray ring on a heading. Do not use `outline-none` on it. The builder checks the browser outline is not clipped by the container.
- Back and forward buttons restore the previous page through the URL, with no `paged` state (it is cleared after use), so focus is not forced on Back, Forward or reload, including to an entry reached via Next. Verified in a memory router only.
- `document.title`: unchanged. Category pages keep `{category} - Catalogue`, search keeps `Search - Catalogue`. A page number would add title state that the pages do not hold and would change on each remount for little gain: the focused `h1` and the "Page X of Y" label already tell the user where they are.

### Page past the end

Trigger: `page > 1` and `products` is empty (not `total > 0`; `design-gaps.md`, conflict 5). The URL can reach it by editing `?page=`.

```
h1                                             unchanged (category name, or Results for "term")
Alert (info) > AlertDescription                "That page does not exist."
Button variant="secondary" asChild > Link to={to(1)}   "Go to the first page"
```

- `Alert` info with the info glyph, on `surface-muted`, `role="status"`, as the unknown-category notice. `space-4` between the alert and the link. Link is a secondary `Button`, at least `touch-target` tall, 2px `focus` outline with 2px offset.
- No `Pagination`, no section headings, no grid. On the category page "Top rated" is also empty here (the server sends `[]` after page 1), so nothing else shows.
- Page 1 with nothing to show keeps the existing empty state: category "No products found" / "No products in this category yet. Try another category."; search `No products match "term"` / "Try a different word or browse a category."
- A malformed `page` (for example `?page=abc` or `0`) is answered by the server with 400 `fields.page`. Search shows the generic "Products did not load" error (it only treats `fields.q` as its own message); the category page shows its generic error. No new copy. Noted for the architect below the rulings in the report; the builder decides whether to parse `page` leniently on the client.

### States summary

| State | Control |
| --- | --- |
| Loading | Not shown. Placeholder cards under the `h1`. |
| Ready, one page or fewer | Not shown. |
| Ready, page 1 of Y | `Previous` disabled, `Page 1 of Y`, `Next` link. |
| Ready, middle page | Both links. |
| Ready, last page | `Previous` link, `Next` disabled. |
| Past the end | Not shown; alert plus "Go to the first page". |
| Error | Not shown; existing error copy, unchanged. |
| Empty (page 1) | Not shown; existing empty copy, unchanged. |

### Accessibility

- One `nav` named "Pagination" per page. `rel="prev"` and `rel="next"` on the links.
- Links are real `<a>`; the ends are real `<button disabled>`. Names: "Previous page", "Next page". Name-in-label rule holds.
- Contrast: `ink` on `surface` for the label, `border-control` on the buttons (3:1), `ink-muted` on `surface-muted` for the disabled state (same pair as other disabled controls).
- No colour-only state: the disabled button is also unavailable to the keyboard and screen reader, and the label states the position in words.
- No motion: no transition or smooth scroll; `scrollTo(0, 0)` is instant.

### Copy

Sentence case, plain, no exclamation marks, no emoji.

| Where | Text |
| --- | --- |
| Previous button (visible) | Previous |
| Previous button (accessible name) | Previous page |
| Position label | Page 2 of 5 (pattern: `Page {page} of {totalPages}`) |
| Next button (visible) | Next |
| Next button (accessible name) | Next page |
| `nav` name | Pagination |
| Past-the-end message | That page does not exist. |
| Past-the-end link | Go to the first page |
| Loading label (accessible only) | Loading products |
| Error title and body | Unchanged (Products did not load / Check your connection and refresh the page to try again.) |
| Document titles | Unchanged: `{category} - Catalogue`, `Search - Catalogue` |

## Product page

Route `/products/:id`. Rendered inside `RootLayout > main`. Composed in `client/src/pages/ProductPage.tsx`; no `ProductDetail` component (ruled in design-gaps, issue 6). The card title link and `Enquire` on home, category and search all land here.

### Component tree

```
ProductPage
  (inside RootLayout > main)
  status "ready":
    Link to="/"  "Back to products"                  t-label, accent, underline on hover
    div (two-column block from 600px)
      div  image well                                 aspect-square, surface-muted, space-5 padding
        img  src=image alt=title                      contained, never cropped
        [no image, or load error]  span "No image"    t-body-sm, ink-muted
      div  text column                                stack, gap space-4
        Link to="/categories/{encodeURIComponent(category)}"   category, first letter uppercased by CSS (first-letter on an inner span), t-caption, accent   (hidden when missing)
        h1                                            title, t-heading-lg, ink
        p                                             price via formatPrice, t-price, ink     (hidden when missing)
        p                                             description, t-body, ink                (hidden when missing)
        Dialog
          DialogTrigger asChild > Button "Enquire"    primary, one per page
          DialogContent
            DialogHeader (right padding space-7 so the title clears the close button) > DialogTitle   "Enquire about {title}"
            EnquiryForm(product, onSubmit=sendEnquiry, onCancel=close dialog, onDone=navigate to "/")   see "Enquiry form (issue 7, final state)"
  status "loading":
    div role="status" aria-busy="true" aria-label="Loading product"
      same two-column block with placeholders (no Link, no text)
  status "error" (network, 5xx, anything not 404 or id 400):
    Alert variant="destructive" > AlertTitle + AlertDescription
    Button variant="secondary" "Try again"            re-runs getProduct(id)
  status "not-found" (ApiError 404, or 400 with fields.id):
    h1 "We could not find that product."
    p  body
    Link to="/"  "Go to the catalogue"
```

- Data: `ProductPage` calls `getProduct(id)` from `api.ts` with the route `:id` as given. It does not sort, trim or reshape. Not-found is decided by the `ApiError` type and status, never message text. The person cannot tell a 404 from a malformed id, so both show the same state.
- `Enquire` is the only product action. No cart, buy, wishlist or quantity UI. Price shows as `formatPrice` gives it, no "from" or sale wording.
- `Enquire` is primary because it is the only action on the page. `Send enquiry` in the dialog is also primary, but the dialog covers the page, so two primaries are never visible together.
- Image fallback is the `ProductCard` one: `alt` is the title, "No image" shows when `image` is missing or fails to load. Duplicated here, not extracted (design-gaps).
- `onDone` navigates to `/` so the "Back to products" label in the success state stays true. `onCancel`, `Escape` and the close button close the dialog; focus returns to `Enquire` (Radix, via `DialogTrigger asChild`).
- The dialog holds only `EnquiryForm` and its `DialogTitle`. No `DialogDescription` (the form is its own description) unless Radix warns.
- Dialog chrome comes from `components/ui/dialog.tsx` as it stands: `radius-lg`, `border` hairline, `surface` fill, `space-5` padding, `space-4` between title and form. The dialog's width and button-row breakpoints follow the 600px breakpoint of this page (not Tailwind `sm`). Stock scrim and maximum width are not tokens; see the notes at the end of the issue 6 section in `docs/design-gaps.md`.

### Layout

Breakpoints 600px and 960px only.

| Width | Layout |
| --- | --- |
| Below 600px | One column: back link, image well, then text column. Container padding `space-4`. Image well full width, square. `space-4` between back link and block, `space-5` between image well and text. `Enquire` full width. Dialog fills the width less the stock edge margin; form fields and buttons stack full width. |
| 600px to 959px | Container padding `space-6`. Two equal columns (image left, text right), gap `space-5`, aligned to the top. Image column never narrower than `card-min`. `Enquire` natural width, left aligned. Dialog at its stock maximum width, centred; form buttons in one row, right aligned. |
| 960px and up | `main` top and bottom `space-8`. Same two equal columns, within `container-max`, gap `space-7`. Image well stays square, so it grows with its column. Section gap to the back link `space-5`. |

- Image well: `surface-muted`, `radius-lg`, `space-5` padding around the image (README: padding around product images). The image is contained, never cropped, never upscaled past the well.
- Text column: stack gap `space-4`; the category line sits `space-2` above the title; `Enquire` sits `space-5` below the last text.
- Long titles and descriptions wrap (`overflow-wrap: anywhere` on the title) and never truncate; no horizontal scroll at 320px.
- Targets: back link, category link, `Enquire`, `Try again`, "Go to the catalogue" and every dialog control are at least `touch-target` (44px) tall. Focus is a 2px `focus` outline with 2px offset on every one, never removed. The dialog's stock close button must also reach `touch-target`; builder to check.

### States

| State | What the user sees |
| --- | --- |
| Loading | Wrapper `role="status"` with `aria-busy="true"` and the accessible name "Loading product". Placeholder image well (`surface-muted`, square) and text bars (`surface-muted`, `radius-sm`, title bar taller, then price, then two description bars). No heading, no links, no `Enquire`, no spinner, no animation. Same two-column layout as ready, so the page does not jump. `document.title` is `Catalogue`. |
| Ready | As the tree. Missing category, price or description hides only that line. |
| Error | Back link is not shown. `Alert` destructive with the alert glyph, title "Product did not load", body "Check your connection and try again.", then a secondary `Button` "Try again" below it. Announced with `role="alert"`. "Try again" returns to loading and calls `getProduct(id)` again. `document.title` `Catalogue`. |
| Not found | `h1` "We could not find that product." (`t-heading-lg`), body `p` "It may have been removed. Browse the catalogue to find something else." (`t-body`, `ink`), link "Go to the catalogue" underlined, to `/`. Header nav and search stay as other ways out. `document.title` "Product not found - Catalogue". |

### Enquiry form (issue 7, final state)

No new component. `EnquiryForm(product, onSubmit, onDone, onCancel)` inside the product page `Dialog`; it takes only `Product` and an injected `onSubmit`. `sendEnquiry` (in `api.ts`) rejects with an `EnquiryError { fields?, message? }` (from `lib/enquiry.ts`) for a 400 with `fields` and for the 429, 413 and `enquiry_not_sent` responses; any other rejection is a plain failure. The form checks `instanceof EnquiryError` only and never imports `ApiError`.

```
EnquiryForm(product, onSubmit, onDone, onCancel)
  status "idle" | "sending" | "error":
    form noValidate aria-busy={sending}
      product summary                              surface-muted, radius-md, space-4 padding
      Field name      Label "Your name"            Input type=text   name=name  autoComplete=name   aria-required
        FieldError id=enquiry-name-error
      Field email     Label "Email"                Input type=email  name=email autoComplete=email  aria-required
        FieldError id=enquiry-email-error
      Field phone     Label "Phone (optional)"     Input type=tel    name=phone autoComplete=tel inputMode=tel
        FieldError id=enquiry-phone-error          (new in #7)
      Field message   Label "Message"              Textarea name=message  aria-required  defaultValue "I am interested in {title}."
        FieldError id=enquiry-message-error
      honeypot div (hidden)                        label "Website" > input name=website
      [status "error"]  Alert variant="destructive" > AlertCircle + AlertTitle + AlertDescription
      div (button row)  Button secondary "Cancel", Button primary type=submit "Send enquiry" | "Sending…"
  status "success":
    Alert variant="success" > CircleCheck + AlertTitle + AlertDescription
    Button primary "Back to products"
```

`Field` here is the `div` stack the form already uses (`Label`, control, `FieldError`, `space-1` apart), not the design-system `Field` component.

#### Fields

| Field | Label | Required | Control | Attributes | Hint |
| --- | --- | --- | --- | --- | --- |
| Name | Your name | Yes | `Input` | `type="text"`, `name="name"`, `autoComplete="name"`, `aria-required="true"` | None |
| Email | Email | Yes | `Input` | `type="email"`, `name="email"`, `autoComplete="email"`, `aria-required="true"` | None |
| Phone | Phone (optional) | No | `Input` | `type="tel"`, `inputMode="tel"`, `name="phone"`, `autoComplete="tel"` | None |
| Message | Message | Yes | `Textarea` | `name="message"`, `aria-required="true"`, prefilled "I am interested in {title}.", no `autoComplete` | None |

- Required marking: the exception is marked, not the rule. Optional is shown in the label as "(optional)" in `ink-muted`; required fields carry no asterisk or word, and are announced as required through `aria-required`. No native `required` attribute (the form is `noValidate`, so the browser's own bubble never replaces our message).
- Every field has a visible `Label` (`t-label`), `space-1` above its control. Never placeholder-only; there are no placeholders.
- Control text is `t-body` (16px, so mobile browsers do not zoom), at least `touch-target` (44px) tall, `surface` fill, `border-control` border, `radius-md`, `space-3` padding. The message `Textarea` is at least `touch-target` tall and grows with its text.
- Fields keep the user's text through validation errors, sending and failure.
- No hints: the labels say enough and the field errors give instructions. No character counter.
- Focus on every control is a 2px `focus` outline with 2px offset, never removed.

#### Honeypot

- Field `name="website"`, label "Website", wrapper `aria-hidden="true"`, input `tabIndex={-1}` and `autoComplete="off"`, moved off screen (not `display: none`, which bots skip). It adds no tab stop and no screen-reader content, takes no space and causes no horizontal scroll in the dialog.
- Not validated, never shown an error. The form sends `website` only when it is non-empty; the server's honeypot check then answers `201` without sending mail, and that `201` decides success (the form does not short-circuit). A person never sees it.
- `EnquiryPayload` has an optional `website` for this. The markup is a raw label and input with a raw off-screen offset on purpose: it is hidden from everyone and is not a design measurement.

#### States

| State | What the user sees |
| --- | --- |
| Closed | Page as ready. Focus returns to `Enquire` after any close (Radix). |
| Idle | `DialogTitle` "Enquire about {title}". Product summary on `surface-muted`: title (`t-label`), category (`t-caption`, `ink-muted`), price (`t-price`). Fields in a stack, gap `space-4`. Buttons "Cancel" (secondary) and "Send enquiry" (primary). Focus lands on the first field when it opens. |
| Validation, client | On submit, an empty or whitespace name, an email that is not `x@y.z` shaped, or an empty message shows an instruction under that field in `danger`, `t-body-sm`, with the alert glyph (so not colour alone), field border `danger`. The field gets `aria-invalid="true"` and `aria-describedby` set to the message id. Nothing is sent. Focus moves to the first invalid field in order name, email, phone, message. There is no summary list: with at most four fields the message sits right under each one and the focused field's description is read with it. Phone is never invalid on the client. |
| Validation, server | A 400 with `fields` is shown the same way, under the matching field, with the server's own text (for example "Use digits, spaces and + - ( ) only." under phone, "Use 2000 characters or fewer." under message, "Enter your name on one line." under name). Focus moves to the first of those fields in the same order. Fields that are fine show nothing. The form stays on screen with the user's text. |
| Server field not shown | If the server returns a key the form has no slot for (`product`, or any unknown key), it is not shown inline. If at least one visible field came back with it, the inline errors win and no alert shows. If none did, the failure alert shows with the generic text (the server's "Check the highlighted fields." is not used: nothing is highlighted). |
| Error cleared | The inline errors and the failure alert clear on the next submit. A failed send followed by an invalid resubmit clears the old alert, so it never shows beside new inline errors. Editing a field does not clear its error on its own (no live validation). |
| Sending | `form aria-busy="true"`. "Send enquiry" reads "Sending…" and both buttons are `disabled` (`surface-muted` fill, `ink-muted` text). A second submit (button, Enter in a field) is ignored while sending, so one click sends one request. Fields keep their values. No spinner, no animation. |
| Failure | See the failure table below. The destructive `Alert` sits inside the form, below the message field and above the buttons, so it stays next to the button the person presses again. `role="alert"` (stock for `destructive`), so it is announced when it appears. Fields keep their values and both buttons are enabled again. Focus returns to "Send enquiry" (the disabled button lost it), so a keyboard user can press it again or Shift+Tab to the fields. |
| Success | The form is replaced by an `Alert` success with the check glyph (`role="status"`, stock), title "Enquiry sent", body "Thank you. We will reply by email.", and a primary `Button` "Back to products" that calls `onDone` and navigates to `/`. Focus moves to "Back to products" (the focused control was removed with the form, so it must be placed) and the button is described by the alert text through `aria-describedby`. The dialog title stays "Enquire about {title}"; it is the dialog's name, and the alert and button carry the message. The close button and `Escape` still work and leave the person on the product page; accepted. Success is shown only after `onSubmit` resolved, that is, after the server's `201` (also the answer to a honeypot hit). |

#### Failure alert copy

Title is always "Enquiry not sent". The body is the server's message when the rejection is an `EnquiryError` with a `message`, shown as given (the client does not rewrite or translate it); otherwise the generic text. Every body says what happened and what to do.

| Cause | Source | Body |
| --- | --- | --- |
| Network down, timeout, 5xx other than `enquiry_not_sent`, anything unexpected | Generic | Your enquiry was not sent. Check your connection and try again. |
| 404 unknown product | Client message | We could not find that product. Go back to the catalogue and try again. |
| 429 rate limited | Server message | You have sent several enquiries. Try again in a few minutes. |
| 502 `enquiry_not_sent` (mail not delivered) | Server message | We could not send your enquiry. Try again in a moment. |
| 413 payload too large | Server message | That enquiry is too large. Shorten your message and try again. |
| 400 with only fields the form does not show | Generic | Your enquiry was not sent. Check your connection and try again. |

- The generic body mentions the connection, which is wrong for a 400 on `product`, but the person can only retry and that case cannot be fixed from the form; accepted. A 404 has its own message (above) because the connection is fine.
- No countdown or `Retry-After` is shown; "a few minutes" is enough.
- The failure is not a toast and not a page; nothing in the dialog is replaced.

#### Dialog behaviour

- Keyboard: focus lands on the first field when the dialog opens. Tab order is name, email, phone, message, Cancel, Send enquiry, then the close button, which comes after the content (better for a form dialog). Focus is trapped; Shift+Tab from the first field wraps to the close button. Enter in a single-line field submits; Enter in the message adds a new line. The honeypot is never reached.
- `Escape`, the close button, a click on the scrim and "Cancel" all close the dialog and return focus to `Enquire`. Unsent text is dropped (the form unmounts); no confirm step. Cancel is disabled while sending, but the other three still close the dialog; the request completes regardless and a resubmit is limited by the server's rate limit. Accepted for the PoC.
- A closed dialog opens with a fresh form (idle, prefilled message), so a past failure or success never shows on the next open.
- Content taller than the viewport scrolls inside the dialog (stock `max-h` and `overflow-y-auto`); focusing an invalid field scrolls it into view.

#### Responsive

Breakpoints 600px and 960px only; the form changes only at 600px.

| Width | Layout |
| --- | --- |
| Below 600px | Dialog fills the width less the stock edge margin. Fields, alert and buttons are full width and stacked; "Send enquiry" on top, "Cancel" under it, `space-2` apart. Each button at least `touch-target` tall. Error and alert text wrap. |
| 600px and up (including 960px and up) | Dialog at its stock maximum width, centred. Buttons in one row, right aligned, `space-2` apart, "Cancel" left of "Send enquiry". Fields stay one column, full width of the dialog. |

#### Accessibility

- Labels are real `<label for>` elements. Errors use `aria-invalid` and `aria-describedby` only while an error shows; both are removed when it clears, so no reference dangles.
- Failure is announced by `role="alert"`, success by `role="status"` plus focus on the button; sending is exposed through `aria-busy` on the form and the changed button label.
- State is never colour alone: glyph, title and words on every error and alert. Error text is `danger` on `surface` (4.5:1), borders `border-control` or `danger`.
- The dialog is a Radix `dialog` named by `DialogTitle`, with focus trap and `Escape`.

### Responsive and a11y notes

- Landmarks: `header` (nav, search), `main`. The dialog is a Radix `dialog` with focus trap, `Escape` to close and the title as its name.
- Heading order: `h1` only on the page; the dialog title is the dialog's own name, not an outline heading.
- Order of tab stops after the header: back link, category link, `Enquire`. Inside the open dialog: close, name, email, phone, message, Cancel, Send enquiry.
- Images: `alt` is the product title. State is never colour alone (glyph, title and words on every alert).
- Document title: `{title} - Catalogue` when ready, `Product not found - Catalogue` for not found, `Catalogue` while loading and on error; reset on leave.

### Copy

Sentence case, plain, no exclamation marks, no emoji, no sales words.

| Where | Text |
| --- | --- |
| Back link | Back to products |
| Category link | Category as the server gives it, first letter uppercased by CSS |
| Title (h1) | Product title as given |
| Price | `formatPrice` output |
| Description | As given |
| Primary action | Enquire |
| Image missing | No image |
| Loading label (accessible only) | Loading product |
| Error title | Product did not load |
| Error body | Check your connection and try again. |
| Retry button | Try again |
| Not-found title (h1) | We could not find that product. |
| Not-found body | It may have been removed. Browse the catalogue to find something else. |
| Not-found link | Go to the catalogue |
| Dialog title | Enquire about {title} |
| Field labels | Your name, Email, Phone (optional), Message |
| Prefilled message | I am interested in {title}. |
| Validation (client) | Enter your name. / Enter a valid email address. / Enter a message. (phone has no client message) |
| Dialog buttons | Cancel, Send enquiry, Sending… |
| Failure title | Enquiry not sent |
| Failure body, generic | Your enquiry was not sent. Check your connection and try again. |
| Failure body, 429 (server message) | You have sent several enquiries. Try again in a few minutes. |
| Failure body, 502 (server message) | We could not send your enquiry. Try again in a moment. |
| Failure body, 413 (server message) | That enquiry is too large. Shorten your message and try again. |
| Server field messages | Shown as the server gives them, for example "Use digits, spaces and + - ( ) only." |
| Success title and body | Enquiry sent. Thank you. We will reply by email. |
| Success button | Back to products |
| Document titles | {title} - Catalogue; Product not found - Catalogue |

## Not found (catch-all)

`NotFoundPage` stays as the `*` catch-all for URLs that match no route. It is not used for products (the product page has its own not-found state).

- Heading (h2): "This page does not exist."
- Link: "Go to the catalogue", underlined, goes to `/`.
- Open gap, same as Home: this page has no `h1`. Not part of #6.
