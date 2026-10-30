const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function buildIcs({ id, title, start, end, url, description }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Overlap//Worker//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${id}@overlap`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(title)}`,
  ];
  const desc = [description, url ? `Join: ${url}` : ''].filter(Boolean).join('\n');
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (url) lines.push(`LOCATION:${esc(url)}`, `URL:${url}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// One-click "add to calendar" links (web calendars that accept a link). Everything else uses the .ics attachment.
export function calendarLinks({ title, start, end, url, description }) {
  const details = [description, url ? `Join: ${url}` : ''].filter(Boolean).join('\n');
  const g = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${stamp(start)}/${stamp(end)}`, details });
  if (url) g.set('location', url);
  const iso = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const o = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: title, startdt: iso(start), enddt: iso(end), body: details });
  if (url) o.set('location', url);
  return {
    google: `https://calendar.google.com/calendar/render?${g}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${o}`,
  };
}
