import { useState } from 'react';
import { DateTime } from 'luxon';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DatePicker } from '../components/DatePicker';
import { api, friendlyError } from '../lib/api';
import { allZones, browserZone, fmtMinutes } from '../lib/slots';
import { adminKey, load, RECENT_KEY, save } from '../lib/storage';

const timeOptions = Array.from({ length: 49 }, (_, i) => i * 30);
const OFFSETS: [number, string][] = [
  [1440, '1 day before'],
  [60, '1 hour before'],
  [15, '15 minutes before'],
];
const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export function CreateEvent() {
  const nav = useNavigate();
  const [q] = useSearchParams();
  const zones = allZones();

  const initialDates = () => {
    const from = q.get('from');
    const to = q.get('to');
    if (!from || !to) return [] as string[];
    const out: string[] = [];
    let d = DateTime.fromISO(from);
    const end = DateTime.fromISO(to);
    while (d.isValid && end.isValid && d <= end && out.length < 60) {
      out.push(d.toISODate()!);
      d = d.plus({ days: 1 });
    }
    return out;
  };

  const [title, setTitle] = useState(q.get('title') ?? '');
  const [dates, setDates] = useState<string[]>(initialDates);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(1440);
  const [slot, setSlot] = useState(30);
  const [zone, setZone] = useState(browserZone());
  const [url, setUrl] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [offsets, setOffsets] = useState<number[]>([1440, 60]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setErr('Give your event a name.');
    if (dates.length === 0) return setErr('Pick at least one day.');
    if (end <= start) return setErr('The latest time must be after the earliest time.');
    if (end - start < slot) return setErr('The time window is shorter than one slot.');
    if (url && !/^https?:\/\/\S+$/i.test(url.trim())) return setErr('The meeting link must start with http:// or https://');
    if (email && !emailOk(email.trim())) return setErr('That email address does not look right.');
    setErr('');
    setBusy(true);
    try {
      const r = await api.createEvent({
        title: title.trim(),
        dates,
        day_start_min: start,
        day_end_min: end,
        slot_minutes: slot,
        timezone: zone,
        meeting_url: url.trim() || undefined,
        organizer_name: org.trim() || undefined,
        organizer_email: email.trim() || undefined,
        reminder_offsets: offsets,
      });
      save(adminKey(r.id), r.admin_token);
      const recent = load<{ id: string; title: string }[]>(RECENT_KEY, []).filter((x) => x.id !== r.id);
      save(RECENT_KEY, [{ id: r.id, title: title.trim() }, ...recent].slice(0, 8));
      nav(`/e/${r.id}/created`);
    } catch (x) {
      setErr(friendlyError(x));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mx-4 mb-4 max-w-3xl sm:mx-8 lg:ml-auto px-5 py-6 sm:px-9" aria-label="Create event">
      <h1 className="h-display text-3xl sm:text-4xl">Create your availability grid</h1>
      <p className="mb-5 mt-1 text-lg text-ink-soft">Pick the days, add the meeting link, and everyone marks when they are free.</p>

      <div className="flex flex-wrap gap-8">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <label className="label">
            Event name
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Team catch-up" />
          </label>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-bold text-ink-soft">Which days?</span>
              <span className="text-sm text-muted">{dates.length} selected</span>
            </div>
            <DatePicker value={dates} onChange={setDates} />
          </div>
          <details className="rounded-xl border border-edge-soft bg-field/60 px-3 py-2">
            <summary className="cursor-pointer text-base font-bold text-ink-soft">
              {start === 0 && end === 1440 ? "Whole day" : `${fmtMinutes(start)} to ${end === 1440 ? "24:00" : fmtMinutes(end)}`} · {slot} min slots · {zone} <span className="font-normal underline">change</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="label min-w-28 flex-1">
              Earliest
              <select className="input" value={start} onChange={(e) => setStart(+e.target.value)}>
                {timeOptions.slice(0, 48).map((m) => (
                  <option key={m} value={m}>
                    {fmtMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="label min-w-28 flex-1">
              Latest
              <select className="input" value={end} onChange={(e) => setEnd(+e.target.value)}>
                {timeOptions.slice(1).map((m) => (
                  <option key={m} value={m}>
                    {m === 1440 ? '24:00' : fmtMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="label min-w-28 flex-1">
              Slot length
              <select className="input" value={slot} onChange={(e) => setSlot(+e.target.value)}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </label>
          </div>
          <label className="label">
            Time zone of those times
            <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <span className="text-sm font-normal text-muted">Everyone still sees the grid in their own time zone.</span>
          </label>
            </div>
          </details>
        </div>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <label className="label">
            Meeting link
            <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
            <span className="text-sm font-normal text-muted">Google Meet, Zoom, Teams, anything. Shown to everyone once the time is set.</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="label min-w-56 flex-1">
              Your name
              <input className="input" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organizer" />
            </label>
            <label className="label min-w-56 flex-[2]">
              Your email (for reminders)
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
          </div>
          <fieldset className="m-0 rounded-xl border border-[#b9a479] bg-field px-4 pb-3 pt-2">
            <legend className="px-2 text-sm font-bold text-ink-soft">Email reminders</legend>
            {OFFSETS.map(([m, label]) => (
              <label key={m} className="flex items-center gap-3 py-2 text-lg">
                <input
                  type="checkbox"
                  className="size-5 accent-accent"
                  checked={offsets.includes(m)}
                  onChange={(e) => setOffsets(e.target.checked ? [...offsets, m].sort((a, b) => b - a) : offsets.filter((x) => x !== m))}
                />
                {label}
              </label>
            ))}
            <p className="m-0 mt-1 text-sm text-muted">
              Only people who add their email on the grid get reminders. Emails are never shown to others.
              {api.mode === 'demo' && ' Reminders need the server stack; in demo mode they are not sent.'}
            </p>
          </fieldset>
        </div>
      </div>

      {err && (
        <p role="alert" className="mt-5 rounded-lg border border-[#b3402e] bg-[#f6d9d2] px-4 py-2 text-base text-[#6b1d10]">
          {err}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="text-lg font-bold text-accent no-underline">
          ← Back
        </Link>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create event'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
