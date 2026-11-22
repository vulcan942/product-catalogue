# AI usage

## Tools and models

- Claude Code (VS Code extension) with Claude Sonnet 5.5.

## Agent and rule files

- `.claude/rules/`: one rule file per concern (scope, architecture, data source, email, API, frontend, security, testing, style, git, this log).
- `.claude/agents/`: one agent per pipeline stage (spec-analyst, architect, ui-ux-designer, backend-builder, frontend-builder, test-engineer, design-reviewer, reviewer, docs-scribe).
- `.claude/skills/`: run-pipeline, pre-pr-check, add-provider, design-gap, log-ai-moment.

## Plan

Setup issues 1 to 7 first (repo hygiene, server scaffold, design system wiring, Docker, test tooling, CI, docs), then the feature issues one by one.

## Key prompts

- Asked for the design system on stock shadcn/ui with tokens, primitives and composed components. It shaped the client: colours only in `index.css`, components accept only `Product`.
- Asked for agents and rule files before any feature code, so every stage has written constraints.
- Asked to implement setup issues 1 to 7 on a new branch and open a PR.
- Issue 7: told the pipeline to verify real delivery with docker compose and Mailpit, not only with fake mailers. Result: a `201`, one email in Mailpit with Reply-To set, the real product title (not the client's), and the HTML in the message inert.
- Issue 8: told the agents to stay minimal because `PRODUCT.md` says pagination is a nice-to-have. Result: a small `paginate` helper, two schemas and one `Pagination` component, and a note in `DECISIONS.md` that it is the first thing to cut.

## Where the AI was wrong

- Asked for client design-system steps, it also built a full backend server. I caught it while reviewing the diff; the server was deleted and rebuilt later as a scaffold only.
- First component pass had controls under the 44px minimum in the design system. Caught by comparing against `design-system/README.md`.
- Issue 2, backend fix agent: it reported "placeholder" instead of a real report. Caught by inspecting the diff myself.
- Issue 2, first review: the client still held a Fake Store mapper. The reviewer agent caught it.
- Issue 2, mutation checks: breaking the code on purpose showed three weak tests (non-2xx, invalid JSON, base URL) that still passed. They were tightened.
- Issue 3, config: a hand-written `.length(5)` check on featured ids conflicted with the spec assumption that the count is not enforced. The architect agent caught it.
- Issue 3, design build: the design builder used Tailwind steps that did not match the space tokens (24/32px instead of 32/64px). The design-reviewer agent caught it.
- Issue 3, spec: an assumption said the featured ids have a default, but config has none. The reviewer agent caught it.
- Issue 3, process: a builder ran `git stash` while another builder worked in the same tree. It said so in its report, and the tree was verified intact.
- Issue 3, tests: jsdom failures were a wrong Node on PATH, first misdiagnosed as a Git Bash problem. Later shown to be nvm resolving v20 in both shells.
- Issue 4, focus ring: the stock shadcn `Button`, `Input`, `Textarea` and `Toggle` used `outline-none` with `outline-2` (Tailwind v4), which hid the focus ring. It had been there since the first issues. The design-reviewer agent caught it; it was confirmed by inspecting the built CSS and fixed with `focus-visible:outline-solid`.
- Issue 4, design: the designer did not read `tokens.json` or `contract.md`. It said so in its self-report, the architect re-verified, and one radius token was wrong.
- Issue 4, design: the designer spec used CSS `capitalize`, against the design README ("never title case"). The design-reviewer agent caught it; the build uses first-letter uppercase only.
- Issue 4, server: a hard-coded 404 message about categories would have misled for products. The reviewer agent caught it; the message is now generic and the client supplies its own copy.
- Issue 4, server: malformed percent-encoding in a path returned 500. The reviewer agent caught it with a repro; Express status-400 errors now map to 400 `bad_request`.
- Issue 4, ranking: the `-Infinity - -Infinity` NaN sort pitfall in `byRanking` (two products with no rating gives NaN). `byRanking` now guards it and falls through to the id tie-break.
- Issue 4, process: an unknown peer session asked for the diff. It was not answered.
- Issue 5, server: a repeated `q` (`?q=a&q=b`) reaches the route as an array, not a string, so the schema would not have returned 400 and would have ended in 500. A hand-written schema now returns 400. The builder's test caught it.
- Issue 5, design: the design said to show the default connection copy for a 400. That is false and misleading, because the connection is fine. The builder deviated and the reviewers confirmed it. The docs conflicted with the code, so the docs were changed: a 400 with `fields.q` shows a 'Search did not run' alert with the server's message.
- Issue 5, design: the designer deviated on whitespace between the task and `design.md` (trim versus collapse). It was settled as: the client trims only and the server collapses.
- Issue 5, review: a reviewer said Tailwind `mb-6` is 32px. It is 24px. I checked the arithmetic before acting and made no change.
- Issue 5, docs: an agent edit to `docs/DECISIONS.md` changed the line endings of the #4 bullets and made them show as changed. The original line endings were restored so the diff shows only new lines.
- Issue 6, spec: the spec-analyst did not read `docs/ARCHITECTURE.md` or `docs/PRODUCT.md`. The architect found that `ARCHITECTURE.md` planned the id schema as `min(1).max(32)` while the other docs said a regex. It was caught by the architect's re-verification, and `ARCHITECTURE.md` now matches (`regex(/^[\w-]+$/).max(64)`).
- Issue 6, server: `encodeURIComponent('..')` leaves `..` unchanged, so the adapter's encoding alone did not stop path traversal. The backend builder's own test caught it; the adapter now rejects ids that fail `/^[\w-]+$/`.
- Issue 6, client: the frontend builder repeated the Tailwind spacing mistake from #3 (`gap-5` for `space-5`, `gap-7` for `space-7`; the Tailwind step is 4px, so those are 20px and 28px, not 24px and 48px). The design-reviewer caught it and the arithmetic confirmed it.
- Issue 6, client: `first-letter` does not render on a flex element, so the category label was not uppercased. A class-name test could not catch it; the design-reviewer did. The text is now in an inner span.
- Issue 6, tests: a `document.title` assertion failed once and did not reproduce in about 30 runs. The code reviewer found the root cause: the title is set in a passive effect, so the test raced it. Tests now `waitFor` the title.
- Issue 6, server: the id was trimmed before the regex, so a padded id like ' 7 ' would be accepted. The reviewer caught it; ids are not trimmed and a padded id is a 400.
- Issue 7, spec: the spec-analyst did not read `docs/PRODUCT.md`. The architect's re-verification fixed three things: a 413 mapped to 400 (now `413 payload_too_large`), the nginx header (`$remote_addr` became `$proxy_add_x_forwarded_for`), and the honeypot being stripped by zod (it is now read before validation).
- Issue 7, design: the design had no error slot for the phone field, although the form has one and the server can reject it. Added.
- Issue 7, process: the orchestrator brief contradicted `design.md` on the honeypot (client short-circuit versus sending `website`). The builder followed the brief and the docs were updated to match.
- Issue 7, tests: a builder's script truncated the untracked test file `enquiry.body.test.ts` (5 of 17 tests left). Git could not restore it because it was untracked. The tests and their mutation checks were re-derived.
- Issue 7, server: the rate limiter scanned the whole Map on every request. The reviewer called it a major issue; it now prunes at most once per window.
- Issue 7, server: the rate-limit key helper produced NaN keys for malformed input. The reviewer caught it; a malformed ip is kept as is.
- Issue 7, client: a 404 for an unknown product showed the 'check your connection' copy. The reviewer caught it; it now says 'We could not find that product. Go back to the catalogue and try again.'
- Issue 7, client: a stale failure alert showed beside new inline errors after an invalid resubmit. The design-reviewer caught it; the alert is cleared.
- Issue 7, review: one agent claimed no SMTP adapter test existed, while one did (`smtpMailer.test.ts`).
- Issue 8, spec: the spec-analyst's rule for a page past the end was `total > 0`. That is wrong for a category with 3 or fewer products (`total` is 0 and `topRated` is empty on page 2+). The architect caught it; the rule is `page > 1 && products.length === 0`.
- Issue 8, design: the designer claimed the 320px pager row fits "well under" 288px, from font-size estimates. The reviewer computed about 266px and said it can only be estimated; the docs now say so, and it is not verified in a browser.
- Issue 8, client: `usePagedFocus` left `{ paged: true }` in history state, so a reload or Back re-focused the heading. The reviewer caught it; memory-router tests could not see it. The hook now clears the state after use.
- Issue 8, client: a space inside the sr-only " page" span made jsdom compute the name "Nextpage". The builder fixed it.
- Issue 8, client: "Go to the first page" was built as a primary button instead of secondary. The design-reviewer caught it.
- Issue 8, server: a page maximum of `MAX_SAFE_INTEGER` allowed inexact offset arithmetic. The reviewer caught it; page is capped at 1,000,000.
- Issue 8, client: the exported interface name `ProductPage` collided with the component. The reviewer caught it; it is now `ProductListPage`.
- Issue 9, review: an agent's grep missed `TRUST_PROXY_HOPS` in `docker-compose.yml` and reported it unverified. It was there; a grep confirmed it.
- Issue 9, server: the error handler logged stack traces at error level for routine 400 and 404 responses. A real docker run showed it; routine client errors are now one warn line.
- Issue 9, dependencies: an unused dependency (`tw-animate-css`) and a mismatched `@types/node` (^20 against the Node 22 Dockerfile and CI) survived 17 earlier reviews and were found in the final review.
- Issue 9, process: two unidentified sessions (`observer-sessions-*`) sent status messages asking about stage progress and the diff. They were deliberately not answered or acted on.
- Issue 9, process: the orchestrator ran `git stash pop` on a stash the user had made deliberately, assuming an agent had stashed against the rules, and reversed the user's action without asking. The user confirmed to keep the tree as restored.

## Time spent

Total: 4 hours (stated by the author; not split by activity).

### Measured elapsed time (from git commit timestamps, not an estimate)

Derived from git commit timestamps for issues #2 to #9 (Nov 21 to 22, 2026). It is the elapsed wall-clock time of the agent pipeline between each issue's last commit and the previous one. It is not the author's hands-on time and it is not split by activity: stages overlapped and ran in parallel, and there are no per-stage timings. The author's total above is the hands-on time; this table is elapsed pipeline time and is a different measure.

| Issue | Last commit | Elapsed since the previous issue's last commit |
| --- | --- | --- |
| #2 | Nov 21 13:12 | about 12 min |
| #3 | 14:10 | about 46 min |
| #4 | 14:50 | 40 min |
| #5 | 15:08 | 18 min |
| #6 | 15:44 | 36 min |
| #7 | 21:27 | 5 h 43 min, includes a long idle gap; not a measure of effort |
| #8 | 22:16 | 49 min |
| #9 | Nov 22 10:41 | overnight gap; not measurable |

Issues #2 to #6 ran back to back: about 2 h 45 min from 13:00 to 15:44. Commits are made at the end of each issue's review cycle, so these mark when an issue finished, not when it started.
