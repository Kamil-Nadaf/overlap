# Email reminders

## Behaviour
- Organizer enters an optional email and picks offsets at creation (default 24 h and 1 h before).
- Participants tick "Email me a reminder" and give an email when saving their times. Emails are never shown to anyone.
- When the organizer finalizes a time, the organizer and all opted-in participants get a reminder at each offset, with the meeting link and an `.ics` attachment.
- If a time is set late (say 30 minutes ahead), only the closest reminder is sent, not all of them at once.
- Rescheduling re-sends (the dedupe key includes the final start time). Un-finalizing sends nothing.

## How it works
`worker/` is a small Node service (nodemailer + pg). Every `POLL_SECONDS` (default 60):
1. Select events with `final_start` in the next 8 days.
2. For each recipient, `worker/due.mjs` decides what to send from the offsets, the clock and `reminders_sent`.
3. Send over SMTP, then record in `reminders_sent` (so a failed send is retried next tick).
4. Delete events past `expires_at` (this replaces the pg_cron job in the Docker stack).

It only needs Postgres access plus SMTP, so it runs the same with the Docker database or Supabase.

## Config (env)
`DATABASE_URL`, `APP_URL` (public URL used in the email link), `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `POLL_SECONDS`, `DRY_RUN=1` (log instead of send).

## Providers
Any SMTP: Gmail app password (no domain needed), Brevo SMTP relay, Mailgun, your own server. Mailpit in the compose file catches mail for testing.
Limits change over time, check your provider before relying on a free tier.

## Privacy
Addresses live in `participants.email` and `events.organizer_email`. No RPC returns them. The worker never logs addresses. Each mail says why it was sent.

## Test it
1. `docker compose up -d --build`, create an event with your email, add yourself with the reminder box ticked.
2. Finalize a time about 10 minutes away with the 15-minute offset ticked.
3. Within a minute the mail appears in Mailpit (http://localhost:8025). The next minute sends nothing more.
4. Unit tests: `cd worker && npm test`.
