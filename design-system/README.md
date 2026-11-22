Catalogue is the interface base for a product-browsing site whose job is to turn visits into sales enquiries. People browse a grid of products, filter by category, and send an enquiry about one. There is no checkout, payment, account or order management, and no admin tooling. Styling is a plain placeholder until branding arrives.

## Principles

- **Browse, then enquire.** The only action on a product is `Enquire` (`Button` secondary on a `ProductCard`, primary `Send enquiry` in `EnquiryForm`). Never add "Buy", "Add to cart", quantity, wishlist or basket UI.
- **Three things will change, so each sits behind a seam.**
  - *Look and feel:* change values in `tokens.json`, keep the names. Components read only tokens, so a re-brand is a token edit. Start with `accent`, `accent-hover`, `accent-subtle`, `ink`, the `sans` family and the radii.
  - *Product data:* components accept the normalised `Product` shape only. Map the source (Fake Store API today) at the edge of the app. See the data contracts section.
  - *Email provider:* `EnquiryForm` calls your `onSubmit(payload)` and knows nothing about delivery. Swap providers inside that function.
- **Keep it small.** Reach for the existing components and tokens before adding anything. A new component needs a reason that the seven here cannot cover.

## Content fundamentals

- Write plainly, in the second person ("Tell us what you would like to know"), and use "we" for the business. No exclamation marks, no emoji, no sales language.
- Labels are short verbs or nouns in sentence case: `Enquire`, `Send enquiry`, `Back to products`, `Your name`, `Email`. Never title case or all caps.
- Errors and notices say what happened and what to do: "Your enquiry was not sent. Check your connection and try again." Field errors are instructions: "Enter a valid email address."
- Show prices exactly as the data gives them, formatted with `formatPrice` (default currency `USD`). Do not add "from", "sale" or discount wording.
- Show product titles and categories as the source provides them. Do not rewrite them in code.

## Visual foundations

- **Colour.** Pages are `surface`; image wells, placeholders and info notices are `surface-muted`. Body text is `ink`; secondary text (categories, hints, captions) is `ink-muted`. `accent` is the single brand colour: primary button, selected chip, ghost-button text, focus ring. Put `on-accent` on `accent` and `accent-hover`. Status colours (`success` on `success-bg`, `danger` on `danger-bg`) are used only inside `Notice` and field errors, and always with words.
- **Contrast.** Every text pair here is at least 4.5:1, and control borders (`border-control`) and the focus ring are at least 3:1, on the surfaces named in each token's usage note. Hold the same floor when you re-brand. Light is the only theme; add a second theme in `tokens.json` rather than overriding colours in components.
- **Type.** One system sans stack (`sans`), no font files. Page title `t-heading-lg`, section and form titles `t-heading-md`, card titles `t-heading-sm`, paragraphs `t-body`, hints and errors `t-body-sm`, buttons, labels and chips `t-label`, categories `t-caption`, prices `t-price`. The home hero alone may use `t-display`; use `t-heading-lg` on narrow screens.
- **Spacing.** Use `space-1` to `space-8` only: `space-4` inside cards and between form fields, `space-5` between grid cards, `space-6` between sections on mobile and `space-7` on desktop.
- **Shape.** `radius-md` for buttons, fields and notices; `radius-lg` for cards and the form panel; `radius-pill` for chips. Cards use a `border` hairline with `shadow-card`, rising to `shadow-raised` on hover. No other shadows, no gradients.
- **Layout.** Page content sits in a `container-max` (1200px) column. Product grids use `ProductGrid`, which fits columns of at least `card-min`. Use 600px and 960px as the only breakpoints (below 600px: one column, form full width; 960px and up: full desktop spacing).
- **Interaction states.** Hover shifts a button to its next tone and lifts a card. Focus is a 2px `focus` outline with a 2px offset on every interactive element; never remove it. Disabled controls use `surface-muted` fill with `ink-muted` text. There is no motion: no transitions, animation or loading spinners; loading is shown with placeholder cards and `aria-busy`.
- **Imagery.** Product photos come from the data and are shown contained, never cropped, in a `surface-muted` well. A missing image shows the words "No image". There is no decorative photography or illustration yet.
- **Accessibility.** Controls are at least `touch-target` (44px) tall; chips are 40px. Every field has a visible label. State is never colour alone: selected chips show a check, notices show an icon and a title, errors show a message.

## Iconography

There is no icon set. The four glyphs in use (check, success, alert, info) are small inline SVGs drawn with `currentColor` strokes inside `Chip`, `Notice` and `Field` errors. Do not add emoji, icon fonts or an icon library; add a glyph only when a component needs one, and draw it in the same 20px, 2px-stroke style.

## Components

- `Button`: primary, secondary and ghost actions.
- `Field`: labelled input or textarea with hint and error.
- `Chip` and `ChipGroup`: category filter toggles.
- `Notice`: info, success and danger messages.
- `ProductCard`: one product with an `Enquire` action. Optional `renderTitle(product)` replaces the plain title text, so a page can make it a link without the card knowing the router.
- `ProductGrid`: responsive grid with loading, error and empty states. Optional `renderTitle` is passed to each card. Optional `errorTitle`, `errorBody`, `emptyTitle` and `emptyBody` override the default notice copy.
- `EnquiryForm`: the lead-capture form, delivery-agnostic.
