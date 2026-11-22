---
name: log-ai-moment
description: Record an AI mistake or a key prompt in AI_USAGE.md as it happens. Use whenever AI output was wrong, was caught in review, or a prompt noticeably shaped the solution.
---

# Log an AI moment

`AI_USAGE.md` is a required deliverable and must be built as work happens, not reconstructed at the end (see `.claude/rules/ai-usage-log.md`).

Append to `AI_USAGE.md`, in the matching section:

- **Where the AI was wrong:** what it produced, what was wrong, how it was caught (test, review, running it, reading the diff), and the fix. Use real specifics, for example a file and the symptom.
- **Key prompt or moment:** the instruction or decision, and how it changed the result. Keep 3 to 5 total, so replace a weaker one rather than growing the list.
- **Tools and models:** add any new tool or model used.

Rules:
- Only record things that actually happened in this work. Never invent or embellish an entry.
- Do not write time-spent figures. Only the user writes those.
- One short entry per moment. If `AI_USAGE.md` does not exist yet, create it with the sections: Tools and models, Agent and rule files, Plan, Key prompts, Where the AI was wrong, Time spent.
