---
name: run-pipeline
description: Run the catalogue SDLC pipeline end to end by dispatching the project agents in order with the right handoffs. Use when asked to build the catalogue, start the build, or run the pipeline.
---

# Run the pipeline

Dispatch the agents in `.claude/agents/` in this order. Do not skip a stage, and do not start a stage until its input file exists.

| Stage | Agent | Needs | Produces |
|---|---|---|---|
| 1 | spec-analyst | the assessment brief, docs/ | assumptions in docs/DECISIONS.md |
| 2 | architect | stage 1, design-system/ | docs/ARCHITECTURE.md, docs/design-gaps.md |
| 3 | ui-ux-designer | stage 2 | docs/design.md |
| 4 | backend-builder and frontend-builder, in parallel | stages 2 and 3 | server/, client/, new design-system components |
| 5 | test-engineer | stage 4 | tests, criterion-to-test table |
| 6 | design-reviewer | stage 5 | findings |
| 7 | reviewer | stage 6 | findings |
| 8 | docs-scribe | all | README, DECISIONS, AI_USAGE, PR text |

## Rules

- Work on a feature branch. Confirm with `git branch --show-current` before stage 4.
- Run stage 4 builders in parallel only when the API contract in docs/ARCHITECTURE.md is final.
- If the designer files a gap in docs/design-gaps.md, hand it back to the architect, then continue. Follow the `design-gap` skill.
- After stages 6 and 7, send blocker and major findings back to the owning builder, then re-run the review. Do not move on while blockers are open.
- After each stage, follow the `log-ai-moment` skill if the AI got something wrong.
- Finish with the `pre-pr-check` skill.
- Report each stage briefly: what was produced and what failed. Never claim a stage passed without its command output.
