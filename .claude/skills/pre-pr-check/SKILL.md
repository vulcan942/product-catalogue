---
name: pre-pr-check
description: Verify the repo is ready to commit or open the PR. Use before committing, before opening or updating the PR, and before claiming the work is done.
---

# Pre-PR check

Run each check and report the real result. Do not claim success without the output.

1. **Branch:** `git branch --show-current` is not `main`.
2. **Secrets:** `git status` shows no `.env` or key files staged; `.env.example` exists with every setting used and no real values.
3. **Quality:** typecheck, lint and the full test suite pass in both `server/` and `client/`. Report counts, and report any failure as a failure.
4. **Boundary greps:**
   - `client/` has no references to the Fake Store host and no import from `server/`.
   - `client/` has no raw `fetch(` outside the one API module.
   - no raw hex colours or inline styles outside the theme layer.
5. **Run path:** follow the README from a clean state (for example `docker compose up`) and confirm the app answers and the enquiry email lands in the local mail catcher. Note the minutes it took; it must be under 10.
6. **Docs:** `README.md`, `docs/DECISIONS.md` and `AI_USAGE.md` exist and match what was built. Time-spent is filled in by the user.
7. **Commits:** small, one change each, imperative messages (`.claude/rules/git-workflow.md`).

Output a checklist with pass or fail per item and the evidence line. Leave the PR open; do not merge it.
