# Build prompt for Claude / Kimi Cowork

> **Status:** the app, Docker stack and reminder worker already exist (see PLAN.md section 4b). Use the prompts below for follow-up work, not from scratch. Start with: "Read AGENTS.md, README.md, PLAN.md and docs/. Run `docker compose up -d --build` and test the full flow, fix anything broken, then do the mobile and accessibility pass."

Open the cloned `overlap` folder in the agent, then paste the prompt below. Re-use the "Next milestone" prompt for each later step.

## Before you start (human, 10 minutes)
1. Create the Supabase project and run both SQL files (docs/DEPLOY.md step 1).
2. Put URL + anon key in `.env.local`.
3. Add the two GitHub Actions secrets and set Pages source to "GitHub Actions".

## First prompt (M0 to M2)

```
You are building "Overlap", a when2meet-style group scheduler, in this repository.

Read first, in order: README.md, AGENTS.md, PLAN.md, docs/ARCHITECTURE.md,
docs/DATA_MODEL.md, docs/DESIGN.md. The SQL schema already exists in
supabase/migrations/. Treat AGENTS.md as binding rules.

Do milestones M0, M1 and M2 from PLAN.md section 5:
- M0: scaffold Vite + React + TypeScript (strict) + Tailwind, base '/overlap/', HashRouter,
  ESLint, Prettier, Vitest, scripts from AGENTS.md. The existing .github/workflows/deploy.yml
  must work unchanged.
- M1: typed RPC wrappers in src/lib/api.ts for every RPC in docs/DATA_MODEL.md, env handling,
  friendly error mapping (wrong_pin, forbidden, event_not_found, ...). Never query tables directly.
- M2: Create Event page and success screen (participant link, admin link, copy buttons,
  "save your admin link" warning). Fields: title, description, dates (calendar multi-select and
  "weekdays x N weeks" shortcut), daily start/end, slot length 15/30/60, time zone (default
  browser zone), meeting URL, organizer name and email, reminder offsets (presets). Validate with zod.
  Event page route /e/:id can be a stub that calls get_event and shows the title.

Rules: commit after each milestone with conventional messages; run lint, typecheck, test and
build before each commit; do not invent schema changes; stop after M2 and give me a short report
with what to check manually. If you need a key or a setting, tell me exact steps and wait.
```

## Next milestone prompt (template)

```
Continue Overlap. Re-read AGENTS.md and PLAN.md. Implement milestone <M3|M4|M5|M6|M7|M8>
exactly to its acceptance criteria. Add unit tests for pure logic. Follow docs/DESIGN.md.
Commit, then report: what changed, how to test manually, anything I must configure.
```

## Suggested split
- M3 + M4 together (grid and heatmap share slot logic).
- M5 + M6 together.
- M7 alone (touches Edge Function, secrets, cron).
- M8 last.

## Review checklist for each report
- Does `git status` show no `.env*` or keys?
- Does the app still work on a phone-width window?
- Any direct `.from(` calls in `src/`? There must be none.
- Are times correct when the zone selector changes?
