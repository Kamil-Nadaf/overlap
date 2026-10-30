// Overlap reminder worker. Polls Postgres, emails reminders over SMTP, cleans up expired events.
// Works with the Docker stack or any Postgres that has supabase/migrations/0001_init.sql applied
// (including Supabase: set DATABASE_URL to its connection string).
import pg from 'pg';
import nodemailer from 'nodemailer';
import { humanOffset, plan } from './due.mjs';
import { buildIcs, calendarLinks } from './ics.mjs';

const env = process.env;
const POLL = Math.max(15, Number(env.POLL_SECONDS || 60)) * 1000;
const APP_URL = (env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
const MAIL_FROM = env.MAIL_FROM || 'Overlap <overlap@localhost>';
const DRY = env.DRY_RUN === '1';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 3 });
const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: Number(env.SMTP_PORT || 1025),
  secure: env.SMTP_SECURE === 'true',
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

const fmt = (d, tz) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(new Date(d));
const log = (...a) => console.log(new Date().toISOString(), ...a);

const CONFIRM = -1; // marker row in reminders_sent: "meeting confirmation already emailed"

async function tick() {
  const { rows: events } = await pool.query(
    `select id, title, description, meeting_url, timezone, final_start, final_end,
            reminder_offsets_min as offsets, organizer_name, organizer_email
       from public.events
      where final_start is not null and final_start > now()`,
  );
  const now = Date.now();
  for (const ev of events) {
    const startMs = new Date(ev.final_start).getTime();
    // Everyone who left an email gets the confirmation and reminders; the organizer too.
    const { rows: people } = await pool.query(
      `select distinct lower(email) as email from public.participants
        where event_id = $1 and email is not null and email <> ''`,
      [ev.id],
    );
    const to = new Set(people.map((p) => p.email));
    if (ev.organizer_email) to.add(ev.organizer_email.toLowerCase());

    for (const email of to) {
      const { rows: sentRows } = await pool.query(
        `select offset_min from public.reminders_sent where event_id=$1 and final_start=$2 and recipient=$3`,
        [ev.id, ev.final_start, email],
      );
      const sent = new Set(sentRows.map((r) => r.offset_min));
      const mark = (o) =>
        pool.query(
          `insert into public.reminders_sent (event_id, final_start, offset_min, recipient)
           values ($1,$2,$3,$4) on conflict do nothing`,
          [ev.id, ev.final_start, o, email],
        );
      const { send, markSent } = plan(startMs, ev.offsets, now, sent);

      if (!sent.has(CONFIRM)) {
        // Just decided: send the confirmation now. Any reminder already "due" is covered by it.
        if (!(await sendConfirmation(ev, email))) continue; // retry next tick
        await mark(CONFIRM);
        for (const o of [...markSent, ...(send !== null ? [send] : [])]) await mark(o);
        continue;
      }
      if (send === null && markSent.length === 0) continue;
      if (send !== null && !(await sendMail(ev, email, send))) continue;
      for (const o of markSent) await mark(o);
    }
  }
  // Remove finished events (1 day after the meeting ends) and abandoned ones, so the database stays small.
  const gone = await pool.query(
    `delete from public.events
      where expires_at < now() or (final_end is not null and final_end < now() - interval '1 day')`,
  );
  if (gone.rowCount) log('cleaned up events', { count: gone.rowCount });
}

async function deliver(ev, to, subject, text, html) {
  if (DRY) {
    log('DRY_RUN would send', { subject });
    return true;
  }
  try {
    await mailer.sendMail({
      from: MAIL_FROM, to, subject, text, html,
      ...(ev.organizer_email ? { replyTo: ev.organizer_email } : {}),
      attachments: [{
        filename: 'meeting.ics', contentType: 'text/calendar; charset=utf-8',
        content: buildIcs({ id: ev.id, title: ev.title, start: ev.final_start, end: ev.final_end, url: ev.meeting_url, description: ev.description }),
      }],
    });
    return true;
  } catch (e) {
    log('mail failed:', e.message);
    return false;
  }
}

async function sendConfirmation(ev, to) {
  const link = `${APP_URL}/#/e/${ev.id}`;
  const when = fmt(ev.final_start, ev.timezone);
  const utc = fmt(ev.final_start, 'UTC');
  const by = ev.organizer_name ? ` by ${ev.organizer_name}` : '';
  const subject = `Meeting set: ${ev.title}`;
  const text = [
    `${ev.title} is scheduled${by}.`,
    '',
    `When: ${when} (${ev.timezone})`,
    `      ${utc} (UTC)`,
    ev.meeting_url ? `Join: ${ev.meeting_url}` : '',
    `Event page (shows the time in your own zone): ${link}`,
    '',
    ...calText(ev),
    'You will get a reminder before it starts.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  const html = `<div style="font-family:Georgia,serif;max-width:520px;color:#2b2118">
    <h2 style="margin:0 0 8px">${esc(ev.title)}</h2>
    <p style="margin:0 0 12px">The meeting is scheduled${esc(by)}.</p>
    <p style="margin:0 0 12px"><b>${esc(when)}</b> <small>(${esc(ev.timezone)})</small><br><small>${esc(utc)} UTC</small></p>
    ${ev.meeting_url ? `<p><a href="${esc(ev.meeting_url)}" style="display:inline-block;padding:10px 18px;background:#35617a;color:#fbf3df;text-decoration:none;border-radius:8px">Join the meeting</a></p>` : ''}
    ${calButtons(ev)}
    <p><a href="${esc(link)}">Open the event</a> to see the time in your own zone.</p>
    <p style="color:#6b5a44;font-size:12px">A reminder follows before it starts.</p></div>`;
  const ok = await deliver(ev, to, subject, text, html);
  if (ok) log('sent confirmation', { event: ev.id }); // never log addresses
  return ok;
}

async function sendMail(ev, to, offsetMin) {
  const link = `${APP_URL}/#/e/${ev.id}`;
  const when = fmt(ev.final_start, ev.timezone);
  const utc = fmt(ev.final_start, 'UTC');
  const subject = `Reminder: ${ev.title} starts in ${humanOffset(offsetMin)}`;
  const text = [
    `${ev.title} starts in ${humanOffset(offsetMin)}.`,
    '',
    `When: ${when} (${ev.timezone})`,
    `      ${utc} (UTC)`,
    ev.meeting_url ? `Join: ${ev.meeting_url}` : '',
    `Details and your local time: ${link}`,
    ...calText(ev),
    '',
    'You got this because you asked for a reminder on Overlap.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  const html = `<div style="font-family:Georgia,serif;max-width:520px;color:#2b2118">
    <h2 style="margin:0 0 8px">${esc(ev.title)}</h2>
    <p style="margin:0 0 12px">Starts in <b>${humanOffset(offsetMin)}</b>.</p>
    <p style="margin:0 0 12px">${esc(when)} <small>(${esc(ev.timezone)})</small><br><small>${esc(utc)} UTC</small></p>
    ${ev.meeting_url ? `<p><a href="${esc(ev.meeting_url)}" style="display:inline-block;padding:10px 18px;background:#35617a;color:#fbf3df;text-decoration:none;border-radius:8px">Join the meeting</a></p>` : ''}
    ${calButtons(ev)}
    <p><a href="${esc(link)}">Open the event</a> to see the time in your own zone.</p>
    <p style="color:#6b5a44;font-size:12px">You got this because you asked for a reminder on Overlap.</p></div>`;
  const ok = await deliver(ev, to, subject, text, html);
  if (ok) log('sent reminder', { event: ev.id, offsetMin });
  return ok;
}

const calOf = (ev) => calendarLinks({ id: ev.id, title: ev.title, start: ev.final_start, end: ev.final_end, url: ev.meeting_url, description: ev.description });
const calText = (ev) => {
  const c = calOf(ev);
  return ['', 'Add to your calendar:', `  Google Calendar: ${c.google}`, `  Outlook: ${c.outlook}`, '  Apple, QQ/163 mail or any other calendar: open the attached meeting.ics'];
};
const calButtons = (ev) => {
  const c = calOf(ev);
  const b = (href, label) => `<a href="${esc(href)}" style="display:inline-block;margin:0 6px 6px 0;padding:7px 12px;border:1px solid #35617a;color:#35617a;text-decoration:none;border-radius:8px;font-size:13px">${label}</a>`;
  return `<p style="margin:12px 0 4px"><small>Add to your calendar</small><br>${b(c.google, 'Google Calendar')}${b(c.outlook, 'Outlook')}</p>
    <p style="margin:0 0 12px;color:#6b5a44;font-size:12px">Apple, QQ/163 mail or any other calendar: open the attached meeting.ics</p>`;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function main() {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  log(`worker started, polling every ${POLL / 1000}s${DRY ? ' (dry run)' : ''}`);
  for (;;) {
    try {
      await tick();
    } catch (e) {
      log('tick failed:', e.message);
    }
    await new Promise((r) => setTimeout(r, POLL));
  }
}
main();
