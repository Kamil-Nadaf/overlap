const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
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
