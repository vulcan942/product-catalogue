# Product Catalogue MVP

Read `product.md` for what we are building. The rules below are independent: each file covers one concern and can be changed or removed without affecting the others.

@.claude/rules/product-scope.md
@.claude/rules/architecture-boundaries.md
@.claude/rules/data-source.md
@.claude/rules/email-provider.md
@.claude/rules/backend-api.md
@.claude/rules/frontend.md
@.claude/rules/security-config.md
@.claude/rules/testing.md
@.claude/rules/code-style.md
@.claude/rules/git-workflow.md
@.claude/rules/ai-usage-log.md

## Design system

UI follows `design-system/README.md` (spec), `contract.md` (data shapes) and `tokens.json`. Built on stock shadcn/ui in `client/`.

- Colours live only in `client/src/index.css` (`:root`), mapped from `tokens.json`. Never hard-code colours in components.
- Compose from shadcn components in `client/src/components/ui`. No parallel component library, no new libraries without asking.
- Components accept only `Product`. The only product action is "Enquire". No cart, buy, wishlist, quantity, login or payment UI.
- Buttons and fields at least 44px, chips 40px, field text 16px. Focus is a 2px outline with 2px offset. No animation or transitions.
- Copy: plain, sentence case, second person, no emoji, no exclamation marks. Errors say what happened and what to do.
- Contrast: text at least 4.5:1, control borders and focus ring at least 3:1.
- `EnquiryForm` calls an injected `onSubmit` and knows nothing about the email provider.
- Run `npm run typecheck` and `npm run lint` in `client/` before calling work done.
