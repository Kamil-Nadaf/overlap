# Agent rules for Overlap

Read `README.md`, `PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DESIGN.md` first. `docs/REMINDERS.md` for M7.

## Ground rules
- Work one milestone at a time (PLAN.md section 5). Finish, test, commit, then stop and report before the next unless told to continue.
- Small commits, conventional messages (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Do not change the SQL contract casually. If the schema must change, add a new file `supabase/migrations/000N_*.sql`; never edit applied migrations; update docs/DATA_MODEL.md in the same commit.
- Browser code uses `src/lib/api.ts` only (RPC over fetch). Tables are locked; never query them. Keep `demoApi.ts` in sync with the SQL contract.
- Never expose emails or hashes in the UI or logs. Never commit `.env*` (except `.env.example`) or any key.
- Store and compute time as UTC instants. Use Luxon for all zone math. No raw `Date` arithmetic across zones.
- Router: HashRouter. Vite `base` is `/overlap/` for Pages and `/` in the Docker build (`VITE_BASE`).
- Wrap `localStorage` access in try/catch.

## Stack and tooling
React 19, Vite, TypeScript (strict), Tailwind v4, Luxon, react-router (HashRouter), Vitest. Backend calls use plain fetch to the SQL functions (no SDK). Worker: Node + pg + nodemailer. Docker Compose runs everything. npm.

## Commands (create these scripts in package.json)
`npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, `npm test`; worker: `cd worker && npm test`.
Before every commit: typecheck, test, build all pass.

## Definition of done per milestone
Acceptance criteria in PLAN.md met, tests added for pure logic (`slots`, `aggregate`, `ics`, reminder due-logic), docs updated, app runs without console errors.

## Ask the human when
- You need Supabase URL/keys, email provider keys, or GitHub settings changes (give exact steps from docs/DEPLOY.md).
- A decision changes scope, schema, or privacy behaviour.

## Visual rules
Follow docs/DESIGN.md (storybook theme). Time slot grid is the hero of the event page. Background scenes must be swappable without code changes beyond `src/themes/ThemeContext.tsx`.
