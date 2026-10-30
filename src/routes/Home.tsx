import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Globe, Github } from '../components/icons';
import { load, RECENT_KEY } from '../lib/storage';
import { api } from '../lib/api';

interface Recent {
  id: string;
  title: string;
}

export function Home() {
  const nav = useNavigate();
  const today = DateTime.now().plus({ days: 1 }).toISODate()!;
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(DateTime.now().plus({ days: 7 }).toISODate()!);
  const recent = load<Recent[]>(RECENT_KEY, []).slice(0, 4);
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api.getStats().then((s) => alive && s && setUsed(s.events_created), () => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex w-full max-w-xl lg:ml-auto flex-1 flex-col items-center justify-center gap-5 px-4 py-4">
      <div className="card w-full px-5 py-6 sm:px-8">
        <h1 className="h-display text-center text-5xl sm:text-6xl">Overlap</h1>
        <p className="mb-6 mt-2 text-center font-display text-xl font-medium italic text-ink-soft sm:text-2xl">Find the hour where everyone is free.</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new URLSearchParams({ title, from, to });
            nav(`/new?${q.toString()}`);
          }}
        >
          <label className="label">
            Event name
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Team catch-up" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="label min-w-40 flex-1">
              From
              <input type="date" className="input" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="label min-w-40 flex-1">
              To
              <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="mt-1 flex justify-end">
            <button className="btn" type="submit">
              Create grid <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
        {api.mode === 'demo' && (
          <p className="mt-4 rounded-lg bg-[#f0dfb8] px-3 py-2 text-center text-sm text-[#5a4210]">
            Demo mode: events are saved only in this browser. Connect a backend (see docs/DEPLOY.md) to share with other people.
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="pill flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-base">
          <span className="font-bold text-ink-soft">Recent:</span>
          {recent.map((r) => (
            <Link key={r.id} to={`/e/${r.id}`} className="rounded-full bg-accent/10 px-3 py-1 text-accent no-underline">
              {r.title}
            </Link>
          ))}
        </div>
      )}

      {used !== null && used > 0 && (
        <p className="pill m-0 px-4 py-1.5 text-center text-base font-medium text-ink-soft">
          <b className="text-ink">{used.toLocaleString()}</b> {used === 1 ? 'meeting' : 'meetings'} organized with Overlap so far
        </p>
      )}

      <ul className="m-0 flex list-none flex-wrap justify-center gap-3 p-0 text-lg font-medium">
        {[
          ['Simple', null],
          ['No sign-up', null],
          ['Email reminders', <Bell key="b" />],
          ['Every time zone', <Globe key="g" />],
          ['Open source', <Github key="o" />],
        ].map(([t, icon]) => (
          <li key={t as string} className="pill flex items-center gap-2 px-4 py-2 text-ink">
            <span className="text-accent">{icon}</span>
            {t as string}
          </li>
        ))}
      </ul>
    </div>
  );
}
