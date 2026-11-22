---
name: design-gap
description: Handle a missing design-system component. Use when the designer or builder needs a component the design system lacks, before creating anything new.
---

# Design gap loop

A page never defines its own component. A missing piece goes through this loop.

1. **Check first.** Re-read `design-system/README.md` and its component list. Can existing components compose the need (for example `Notice` plus `Button` for a thank-you)? If yes, compose and stop.
2. **File the gap** in `docs/design-gaps.md`: what is needed, which screen, what was tried, and why the existing components do not cover it.
3. **Architect rules** compose or new, with a reason. Prefer compose.
4. **If new**, the frontend-builder adds it inside `design-system/`:
   - tokens only, no raw colours, sizes or fonts;
   - the same props and file conventions as the existing components;
   - states it needs (default, hover, focus, disabled);
   - an entry in the design-system docs and one test.
5. **Then** pages import it from the design system. Mark the gap resolved in `docs/design-gaps.md`.

Never build the component inline in a page or in `client/` to save time. Never add a component that only one screen uses if composing works.
