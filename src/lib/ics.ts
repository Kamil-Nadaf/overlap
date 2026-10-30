const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

export interface CalEvent {
  uid: string;
  title: string;
  startIso: string;
  endIso: string;
  url?: string | null;
  description?: string;
  alarmMinutes?: number[];
}

export function buildIcs(e: CalEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Overlap//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}@overlap`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startIso)}`,
    `DTEND:${stamp(e.endIso)}`,
    `SUMMARY:${esc(e.title)}`,
  ];
  const desc = [e.description ?? '', e.url ? `Join: ${e.url}` : ''].filter(Boolean).join('\n');
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (e.url) {
    lines.push(`LOCATION:${esc(e.url)}`, `URL:${e.url}`);
  }
  for (const m of e.alarmMinutes ?? []) {
    lines.push('BEGIN:VALARM', `TRIGGER:-PT${m}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM');
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(e: CalEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.startIso)}/${stamp(e.endIso)}`,
    details: [e.description ?? '', e.url ? `Join: ${e.url}` : ''].filter(Boolean).join('\n'),
  });
  if (e.url) p.set('location', e.url);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(e: CalEvent, filename = 'overlap-meeting.ics'): void {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
