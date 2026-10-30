# Architecture

```
Browser (static React app: Docker nginx or GitHub Pages)
   |  fetch POST /rpc/<function>
   v
PostgREST (Docker)  or  Supabase REST (/rest/v1)
   |  role anon, only SECURITY DEFINER functions are callable
   v
Postgres  <--- worker (Node): reminders over SMTP, expired-event cleanup
```

Docker Compose runs db, api (PostgREST), web (nginx, proxies /api), worker, mailpit.
GitHub Actions: `deploy.yml` publishes the same build to Pages; `keepalive.yml` only matters for hosted Supabase.

## Security model
- The anon key ships in the JS bundle. Treat it as public.
- All tables have RLS enabled with **no policies** and all privileges revoked from `anon` / `authenticated`. Browser cannot `select` anything directly.
- The browser calls RPCs only (see DATA_MODEL.md). Each RPC returns the minimum.
- **Emails, PIN hashes, admin token hashes never leave the database** via any RPC. Only the worker reads participant emails.
- Event id is 10 chars from a 32-symbol alphabet (about 50 bits), unguessable enough for a capability link. Possessing the link grants view and participate rights, as in when2meet.
- Admin rights need the admin token (128-bit random, SHA-256 hashed at rest). Shown once at creation, kept in `localStorage`, passed in the `?admin=` URL fragment.
- PIN is a convenience lock (bcrypt via `crypt`), not strong auth. Without PIN anyone with the link can edit that name's slots.
- The worker connects with a database URL held only in its environment; it is never exposed to browsers.
- Never log emails. Never commit keys. Service role key and email API key live only in Supabase function secrets.

## Time zone strategy
- Event stores: IANA zone, list of dates, daily window in minutes from midnight **in the event zone**, slot length.
- Slot generation: for each date and each slot start, build the wall-clock time in the event zone with Luxon and convert to a UTC instant. On DST days this naturally skips or repeats wall times.
- Availability stored as UTC instants. The viewer's zone only changes how instants are labelled and grouped.
- Grid layout in viewer zone: group slots by viewer-local date (columns), rows by viewer-local time of day (union across columns). Missing cells are rendered blank and unclickable. Show zone name and UTC offset in the header.
- Reminders and `.ics` use UTC instants (`DTSTART:...Z`), so they are correct everywhere.

## Frontend structure (suggested)
```
src/
  main.tsx, App.tsx
  routes/        Home.tsx  CreateEvent.tsx  EventPage.tsx
  components/    AvailabilityGrid  Heatmap  BestTimes  ParticipantList  TzSelect  DatePicker  FinalizeDialog  ReminderOptIn
  lib/           api.ts (typed RPC wrappers)  slots.ts  aggregate.ts  ics.ts  gcal.ts  tz.ts  storage.ts
  types.ts
  test/          slots.test.ts  aggregate.test.ts  ics.test.ts
```
- State: a small `useEvent` hook polls `get_event` every 15s; local component state for in-progress painting.
- Validation: plain functions in the forms, mirrored by SQL checks.
- `src/lib/api.ts` picks the backend: `VITE_API_URL` (PostgREST) or `VITE_SUPABASE_URL` (+ anon key); with neither, `demoApi.ts` keeps data in localStorage.
- Scenes: `src/themes/ThemeContext.tsx` lists background images from `public/scenes`; the dock lets users switch or upload their own.
- Persist per-event identity (`name`, `pin`, admin token) in `localStorage` with try/catch; the app must work if storage throws.

## Scaling and limits (free tier)
- Payload per `get_event`: all availability rows. A 20-person, 5-day, 18-slot/day event is under 2,000 rows (about 100 KB). Fine. If this grows, add a paged or aggregated RPC.
- Cap: 60 dates per event, 3,000 slots per save.

## Why not realtime
Realtime respects RLS; tables are locked, so subscriptions would receive nothing. Polling is simple and enough. Revisit with a broadcast channel in v1.1.
