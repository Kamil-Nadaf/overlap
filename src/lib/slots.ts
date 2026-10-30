import { DateTime } from 'luxon';
import type { EventInfo } from '../types';

/** Normalize any ISO timestamp from the server to canonical UTC form (…Z, no millis). */
export function normIso(s: string): string {
  const dt = DateTime.fromISO(s, { setZone: true }).toUTC();
  return dt.toISO({ suppressMilliseconds: true }) ?? s;
}

/**
 * All slot start instants for an event, as UTC ISO strings, sorted and unique.
 * Window minutes are wall-clock in the event zone, so DST days skip/shift naturally.
 */
export function generateSlots(ev: Pick<EventInfo, 'dates' | 'day_start_min' | 'day_end_min' | 'slot_minutes' | 'timezone'>): string[] {
  const out = new Set<string>();
  for (const d of ev.dates) {
    const [y, mo, da] = d.split('-').map(Number);
    for (let m = ev.day_start_min; m + ev.slot_minutes <= ev.day_end_min; m += ev.slot_minutes) {
      const dt = DateTime.fromObject(
        { year: y, month: mo, day: da, hour: Math.floor(m / 60), minute: m % 60 },
        { zone: ev.timezone },
      );
      if (dt.isValid) out.add(dt.toUTC().toISO({ suppressMilliseconds: true })!);
    }
  }
  return [...out].sort();
}

export interface GridCol {
  dateKey: string; // viewer-local YYYY-MM-DD
  weekday: string;
  label: string;
}
export interface GridRow {
  minutes: number; // viewer-local minutes from midnight
  label: string;
  hourStart: boolean;
}
export interface Grid {
  cols: GridCol[];
  rows: GridRow[];
  /** cells[row][col] = slot ISO or null when that viewer-local time has no slot */
  cells: (string | null)[][];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Lay slots out as a day × time table in the viewer's own zone. */
export function buildGrid(slots: string[], zone: string): Grid {
  const colMap = new Map<string, GridCol>();
  const rowSet = new Set<number>();
  const where = new Map<string, { d: string; m: number }>();
  for (const s of slots) {
    const dt = DateTime.fromISO(s, { zone });
    const d = dt.toISODate()!;
    const m = dt.hour * 60 + dt.minute;
    where.set(s, { d, m });
    rowSet.add(m);
    if (!colMap.has(d)) colMap.set(d, { dateKey: d, weekday: dt.toFormat('ccc'), label: dt.toFormat('LLL d') });
  }
  const cols = [...colMap.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const rowMins = [...rowSet].sort((a, b) => a - b);
  const rows: GridRow[] = rowMins.map((m) => ({ minutes: m, label: fmtMinutes(m), hourStart: m % 60 === 0 }));
  const colIdx = new Map(cols.map((c, i) => [c.dateKey, i]));
  const rowIdx = new Map(rowMins.map((m, i) => [m, i]));
  const cells: (string | null)[][] = rows.map(() => cols.map(() => null));
  for (const [s, { d, m }] of where) cells[rowIdx.get(m)!][colIdx.get(d)!] = s;
  return { cols, rows, cells };
}

export function describeSlot(iso: string, zone: string, minutes = 0): string {
  const a = DateTime.fromISO(iso, { zone });
  if (!minutes) return a.toFormat('ccc LLL d, HH:mm');
  const b = a.plus({ minutes });
  return `${a.toFormat('ccc LLL d, HH:mm')} to ${b.toFormat('HH:mm')}`;
}

export function zoneLabel(zone: string): string {
  const dt = DateTime.now().setZone(zone);
  const off = dt.offset;
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ':' + pad(m) : ''} ${zone.replace(/_/g, ' ')}`;
}

export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function allZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    const z = fn ? fn('timeZone') : [];
    if (z.length) return z.includes('UTC') ? z : ['UTC', ...z];
  } catch {
    /* fall through */
  }
  return ['UTC', 'Asia/Shanghai', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
}

export interface Week {
  key: string;
  label: string;
  from: number; // first column index
  to: number; // last column index (inclusive)
}

/** Group grid columns into Monday-start weeks so a long event can be shown one week at a time. */
export function weeksOf(grid: Grid): Week[] {
  const weeks: Week[] = [];
  grid.cols.forEach((c, i) => {
    const d = DateTime.fromISO(c.dateKey);
    const monday = d.minus({ days: d.weekday - 1 });
    const key = monday.toISODate()!;
    const last = weeks[weeks.length - 1];
    if (last && last.key === key) last.to = i;
    else weeks.push({ key, label: '', from: i, to: i });
  });
  for (const w of weeks) {
    const a = DateTime.fromISO(grid.cols[w.from].dateKey);
    const b = DateTime.fromISO(grid.cols[w.to].dateKey);
    w.label = w.from === w.to ? a.toFormat('LLL d') : `${a.toFormat('LLL d')} – ${a.month === b.month ? b.toFormat('d') : b.toFormat('LLL d')}`;
  }
  return weeks;
}

/** Keep only the columns of one week, and drop rows that have no slot that week. */
export function sliceGrid(grid: Grid, w: Week): Grid {
  const cols = grid.cols.slice(w.from, w.to + 1);
  const keep: number[] = [];
  grid.cells.forEach((row, ri) => {
    if (row.slice(w.from, w.to + 1).some(Boolean)) keep.push(ri);
  });
  return {
    cols,
    rows: keep.map((ri) => grid.rows[ri]),
    cells: keep.map((ri) => grid.cells[ri].slice(w.from, w.to + 1)),
  };
}
