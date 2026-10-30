# Overlap: Plan

## 1. Goal
Replace ad-hoc "when are you free?" threads for research collaboration meetings. One link, everyone marks
availability, organizer picks a time, everyone gets the meeting link and a reminder.

## 2. Users
- **Organizer**: creates event, sees heatmap, finalizes time, owns meeting link.
- **Participant**: opens link, enters name (optional PIN), paints availability, optionally gives email for reminders.
- Collaborators are spread across time zones (India, China, others), so time zone correctness is a first-class requirement.

## 3. Scope

### MVP (v1)
1. Create event: title, description, dates, daily window (start/end), slot size (15/30/60), event time zone, meeting URL, organizer email.
2. Quick date pickers: calendar multi-select, plus "pick weekdays + N weeks" which expands to concrete dates.
3. Shareable participant link `/#/e/<id>`. Private admin link `/#/e/<id>?admin=<token>` shown once and saved in localStorage.
4. Availability grid: click-drag paint and erase, two levels (available / if need be), touch support, keyboard accessible.
5. Sign-in by name + optional PIN (when2meet style) to re-edit.
6. Group heatmap with counts, hover/tap to see who is free and who is not.
7. "Best times" list: top slots ranked by available count, then if-need-be count, merged into contiguous blocks.
8. Time zone: grid rendered in viewer zone with a selector; default is browser zone; event zone shown.
9. Organizer finalizes a slot: shows banner with time in viewer zone, meeting link button, "Add to calendar" (.ics + Google link).
10. Email reminders for finalized meetings (offsets configurable, default 24h and 1h) to opted-in participants and organizer, with `.ics` attached.
11. Responsive, dark and light themes, polling refresh every 15s.
12. Auto expiry of inactive events after 180 days.

### Later (v1.1+)
- Weekday-only recurring "generic week" events.
- Realtime updates (needs a read-safe channel; currently polling).
- Organizer can edit dates/times after creation.
- Export results CSV.
- Slack/Discord webhook ping on finalize.
- Per-participant time zone preference remembered.
- i18n.

### Non-goals
- Accounts / OAuth.
- Calendar sync (reading Google Calendar busy times).
- Paid features, analytics, ads.

## 4. Decisions (locked unless you change them)
| Topic | Decision | Why |
|---|---|---|
| Name | Overlap | Chosen by Maruf |
| Frontend | React 19 + Vite + TypeScript + Tailwind v4, Luxon | Familiar stack, static output for Pages and Docker |
| Routing | HashRouter | Pages has no SPA fallback |
| Backend | Postgres functions behind PostgREST (Docker) or Supabase. Plain `fetch`, no SDK | Same SQL runs on both; Docker makes it reproducible |
| Packaging | Docker Compose: db, api, web, worker, mailpit | `docker compose up` recreates everything |
| Data access | RLS locked, RPC-only | Emails and hashes never reach the browser |
| Time storage | UTC instants (`timestamptz`) per slot | Correct across DST and zones |
| Time lib | Luxon | Reliable IANA zone math |
| Reminders | Node worker (nodemailer, SMTP), polls Postgres | One implementation for Docker and Supabase; Gmail app password works without a domain |
| Hosting | GitHub Pages via Actions | Free |
| Pause fix | Keepalive workflow (Supabase only) | Free Supabase projects pause after 7 days idle |
| Look | Storybook theme, swappable scenes | See docs/DESIGN.md and the Overlap UI Theme canvas |

## 4b. Status (2026-10-30)
Done: M0 scaffold, M1 backend contract (SQL verified on real Postgres), M2 create event, M3 availability grid with drag paint, M4 heatmap and best times, M5 time zones, M6 finalize and calendar, M7 reminder worker (logic tested, needs a live Docker run), Docker stack, scene system.
Next: run `docker compose up` end to end, mobile pass, a11y pass, replace starter scene images, M8 polish.

## 5. Milestones

Each milestone ends in a working, committed, deployable state.

### M0. Scaffold and deploy (0.5 day)
- Vite + React + TS + Tailwind, `base: '/overlap/'`, HashRouter, ESLint, Prettier, Vitest.
- `.github/workflows/deploy.yml` deploys to Pages.
- **Accept:** `https://kamil-nadaf.github.io/overlap/` serves a placeholder page.

### M1. Backend (0.5 day)
- Create Supabase project, run `supabase/migrations/*.sql`.
- Typed client wrapper `src/lib/api.ts` for each RPC. Env via `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Accept:** from the browser console, `create_event` then `get_event` round-trip works; direct `select` on tables is denied for anon.

### M2. Create event (1 day)
- Form with validation (zod), date picker, time window, zone selector (default browser zone), meeting URL, organizer email.
- Success screen with participant link, admin link (copy buttons), warning to save the admin link.
- **Accept:** event created, both links work, invalid input rejected with clear messages.

### M3. Availability grid (1.5 days)
- Slot generation in event zone to UTC instants (`src/lib/slots.ts`) with unit tests incl. DST dates.
- Paint/erase drag, level toggle, touch, keyboard; sign-in by name + PIN; save via `save_availability`.
- **Accept:** two browsers, two names, both saved; reload keeps data; wrong PIN rejected.

### M4. Heatmap and best times (1 day)
- Aggregate counts, color ramp plus numeric labels, hover/tap who-is-free panel, best-times list.
- **Accept:** results match hand-computed fixture in unit tests.

### M5. Time zones (0.5 day)
- Viewer zone selector; grid columns grouped by viewer-local date; zone abbreviation and UTC offset labels.
- **Accept:** same event viewed from Asia/Kolkata, Asia/Shanghai, America/New_York shows consistent instants; unit tests for a DST boundary.

### M6. Finalize and calendar (0.5 day)
- Admin finalizes slot, un-finalize, edit meeting link. Banner for everyone. `.ics` generator and Google Calendar URL.
- **Accept:** `.ics` imports correctly into Apple, Google, Outlook with right time and link.

### M7. Reminders (1 day)
- Edge Function `send-reminders`, pg_cron + pg_net schedule, dedupe table, opt-in checkbox with email field.
- **Accept:** finalize a meeting 2 minutes ahead in a test offset; email arrives once; reschedule re-sends; unsubscribed or no-email users get nothing. See docs/REMINDERS.md.

### M8. Polish and hardening (1 day)
- Dark/light, empty and error states, loading skeletons, a11y pass, mobile pass, favicon and OG tags.
- Keepalive workflow, README screenshots, rate-limit and abuse notes.
- **Accept:** Lighthouse a11y >= 95, works at 360px width, no console errors.

Total: about 7 working days of agent time.

## 6. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Supabase free project pauses after 7 idle days | `keepalive.yml` calls the `ping()` RPC every 3 days (a real API request, which is what resets the idle timer) |
| Free email limits / sender verification | Provider abstraction; verify Brevo/Resend free terms before M7; fall back to `.ics` + calendar reminders |
| Spam creation of events | Row caps in SQL; add Cloudflare Turnstile or per-IP rate limit in an Edge Function if abused (v1.1) |
| PIN brute force | PINs are optional convenience, not security; document it; add attempt throttling in v1.1 |
| GitHub disables scheduled workflows after 60 days of repo inactivity | Pings also run from pg_cron side for reminders; commit occasionally or re-enable |
| DST bugs | Store UTC instants; test on DST transition dates |
| Anon key is public | By design. Safety comes from RLS + RPC-only access |

## 7. Definition of done (v1)
All M0-M8 acceptance checks pass, deployed on Pages, README has screenshots, one real meeting scheduled with it.
