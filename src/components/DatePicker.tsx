import { useState } from 'react';
import { DateTime } from 'luxon';

interface Props {
  value: string[]; // YYYY-MM-DD
  onChange: (v: string[]) => void;
}

export function DatePicker({ value, onChange }: Props) {
  const [month, setMonth] = useState<DateTime>(() => (value[0] ? DateTime.fromISO(value[0]) : DateTime.now()).startOf('month'));
  const sel = new Set(value);
  const first = month.startOf('week'); // Luxon weeks start Monday
  const days = Array.from({ length: 42 }, (_, i) => first.plus({ days: i }));
  const today = DateTime.now().toISODate();

  const toggle = (iso: string) => {
    const s = new Set(sel);
    if (s.has(iso)) s.delete(iso);
    else s.add(iso);
    onChange([...s].sort());
  };
  const quick = (from: DateTime, n: number, weekdaysOnly: boolean) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const d = from.plus({ days: i });
      if (weekdaysOnly && d.weekday > 5) continue;
      out.push(d.toISODate()!);
    }
    onChange(out);
    setMonth(from.startOf('month'));
  };
  const tomorrow = DateTime.now().plus({ days: 1 }).startOf('day');
  const nextMon = DateTime.now().plus({ weeks: 1 }).startOf('week');

  return (
    <div className="rounded-xl border border-[#b9a479] bg-field p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(month.minus({ months: 1 }))} className="size-10 cursor-pointer rounded-lg border border-edge-soft bg-paper text-lg">
          ‹
        </button>
        <div className="h-display text-2xl">{month.toFormat('LLLL yyyy')}</div>
        <button type="button" aria-label="Next month" onClick={() => setMonth(month.plus({ months: 1 }))} className="size-10 cursor-pointer rounded-lg border border-edge-soft bg-paper text-lg">
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = d.toISODate()!;
          const on = sel.has(iso);
          const past = iso < today!;
          const out = d.month !== month.month;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={on}
              aria-label={d.toFormat('cccc d LLLL yyyy')}
              disabled={past}
              onClick={() => toggle(iso)}
              className={`h-11 cursor-pointer rounded-lg border text-base font-medium disabled:cursor-not-allowed disabled:opacity-35 ${
                on ? 'border-accent-d bg-accent text-field' : 'border-edge-soft bg-paper text-ink hover:brightness-95'
              } ${out && !on ? 'opacity-50' : ''}`}
            >
              {d.day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button type="button" className="cursor-pointer rounded-full border border-accent bg-transparent px-3 py-1.5 font-bold text-accent" onClick={() => quick(tomorrow, 7, false)}>
          Next 7 days
        </button>
        <button type="button" className="cursor-pointer rounded-full border border-accent bg-transparent px-3 py-1.5 font-bold text-accent" onClick={() => quick(nextMon, 5, true)}>
          Next week, Mon to Fri
        </button>
        <button type="button" className="cursor-pointer rounded-full border border-accent bg-transparent px-3 py-1.5 font-bold text-accent" onClick={() => quick(nextMon, 12, true)}>
          Next 2 weeks, weekdays
        </button>
        <button type="button" className="cursor-pointer rounded-full border-0 bg-transparent px-3 py-1.5 font-bold text-muted underline" onClick={() => onChange([])}>
          Clear
        </button>
      </div>
    </div>
  );
}
