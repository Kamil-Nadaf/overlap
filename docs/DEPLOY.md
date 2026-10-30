# Run and deploy

The app is a static site plus a tiny backend that is just a few Postgres functions
(`supabase/migrations/0001_init.sql`). Pick where each piece lives.

| Piece | Option 1: all in Docker (easiest) | Option 2: Pages + Supabase |
|---|---|---|
| Web app | `web` container (nginx) | GitHub Pages |
| Database + API | `db` + `api` (PostgREST) containers | Supabase free project |
| Reminders | `worker` container (SMTP) | same worker, run it anywhere (e.g. your Mac mini) |

You can also mix: GitHub Pages frontend + Docker backend on your Mac mini, made public with a tunnel.

## Option 1: everything in Docker
```bash
cp .env.example .env            # set POSTGRES_PASSWORD at least
docker compose up -d --build
```
- App: http://localhost:8080
- Caught reminder emails (dev): http://localhost:8025 (Mailpit)
- Stop: `docker compose down`. Data lives in the `db-data` volume (`docker compose down -v` deletes it).
- Rebuild after code changes: `docker compose up -d --build web`.
- Fresh DB after schema changes: new migrations are not re-run on an existing volume; apply them with
  `docker compose exec -T db psql -U postgres -d overlap < supabase/migrations/000N_xxx.sql`.

### Make it reachable by your collaborators (Mac mini)
1. Run the stack on the Mac mini. Set `APP_URL` in `.env` to the public URL.
2. Expose port 8080 over HTTPS: Tailscale Funnel (`tailscale funnel 8080`) or a Cloudflare Tunnel.
3. Keep the Mac mini awake. Back up with `docker compose exec db pg_dump -U postgres overlap > backup.sql`.

### Real reminder emails
Set SMTP in `.env` and `docker compose up -d worker`. Gmail works without a domain:
create an App Password (Google Account, Security, 2-Step Verification, App passwords), then
`SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_SECURE=false SMTP_USER=you@gmail.com SMTP_PASS=<app password>`
and `MAIL_FROM=Overlap <you@gmail.com>`. Gmail limits sending volume; fine for a research group.

## Option 2: GitHub Pages + Supabase (free, shareable)
1. **Project.** supabase.com, New project (free plan). Pick a region near your group and save the database password.
2. **Database.** Dashboard, SQL Editor, New query: paste all of `supabase/setup.sql`, Run. It should say "Success". (The cleanup part is optional and skips itself if pg_cron is off.)
3. **Keys.** Project Settings, API: copy the **Project URL** and the **anon public** key. The anon key is meant to be public; it cannot read tables, only call the functions in the SQL above.
4. **GitHub secrets.** Repo, Settings, Secrets and variables, Actions, New repository secret:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
5. **Deploy.** Repo, Actions, "Deploy to GitHub Pages", Run workflow (or push to `main`). Site: https://kamil-nadaf.github.io/overlap/ . The "Demo mode" banner disappears when it is connected.
6. **Keepalive.** `keepalive.yml` pings Supabase every 3 days so the free project does not pause.
7. **Emails.** Supabase only stores data; the worker sends the emails, so run it somewhere always on (your Mac mini):
   ```bash
   cp worker.env.example worker.env     # fill in DATABASE_URL (Session pooler URI), APP_URL, Gmail app password
   docker build -t overlap-worker ./worker
   docker run -d --restart unless-stopped --env-file worker.env --name overlap-worker overlap-worker
   docker logs -f overlap-worker        # "worker started" means it is polling
   ```
   Without the worker everything works except email.

Docker backend instead of Supabase? Add the secret `VITE_API_URL=https://your-public-host/api` and skip steps 1 to 4.

## Local development (no Docker)
```bash
npm install
npm run dev        # http://localhost:5173/overlap/ , demo mode (data in your browser)
npm test && npm run typecheck && npm run build
```
Add `VITE_API_URL=http://localhost:8080/api` to `.env.local` to develop against the Docker backend.

## Check it is locked down
`docker compose exec db psql -U postgres -d overlap -c "set role anon; select * from public.events;"`
must say `permission denied`.

## Troubleshooting
- Blank page on Pages: `base` must be `/overlap/` (default) and the app uses HashRouter.
- Docker build for the web image sets `VITE_BASE=/`; do not reuse that build on Pages.
- "Cannot reach the server": `docker compose logs api web`; check `POSTGRES_PASSWORD` has no special characters that break URLs (use letters and digits).
- No reminder arrives: `docker compose logs worker`; event must be finalized, person must have ticked the reminder box and given an email.
