# Overlap

Find the hour where everyone is free. A when2meet-style group scheduler with a storybook look,
real time-zone handling, meeting links and email reminders.

**Live (after first deploy):** https://kamil-nadaf.github.io/overlap/

## Run it
```bash
cp .env.example .env        # set POSTGRES_PASSWORD
docker compose up -d --build
# app http://localhost:8080   test emails http://localhost:8025
```
No Docker? `npm install && npm run dev` runs a demo mode that keeps data in your browser.

## What it does
- Create an event: days, daily time window, slot length, time zone, meeting link, organizer email.
- Share one link. Everyone paints free slots by dragging (tap on a phone): *available* or *if need be*.
- "Everyone" view: heatmap with counts, who is free per slot, ranked best times.
- Every viewer sees times in their own zone. Organizer sets the final time, then calendar download, Google Calendar link and email reminders.
- Swap the background scene any time (dock at the bottom), upload your own image, day/night, "View scene" to hide the UI.

## Stack
React + Vite + TypeScript + Tailwind, Luxon. Backend: Postgres functions behind PostgREST (Docker) or Supabase. Reminder worker: Node + nodemailer.

## Docs
[PLAN](PLAN.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Reminders](docs/REMINDERS.md) · [Deploy](docs/DEPLOY.md) · [Design](docs/DESIGN.md) · [Agent rules](AGENTS.md)

## Layout
```
src/            app (routes, components, lib, themes)
public/scenes/  default background (swap default.jpg, or use "+ Your image" in the app)
supabase/       SQL migrations (the whole backend contract)
worker/         reminder worker
docker/         nginx + Postgres init
docker-compose.yml, Dockerfile
```
