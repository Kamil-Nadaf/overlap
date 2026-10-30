import type { AvailabilityRow, Level, Participant } from '../types';
import { normIso } from './slots';

export interface SlotTally {
  slot: string;
  yes: string[]; // participant ids available
  maybe: string[]; // participant ids "if need be"
  count: number; // yes + maybe
}

export function tally(slots: string[], rows: AvailabilityRow[]): Map<string, SlotTally> {
  const map = new Map<string, SlotTally>();
  for (const s of slots) map.set(s, { slot: s, yes: [], maybe: [], count: 0 });
  for (const r of rows) {
    const t = map.get(normIso(r.s));
    if (!t) continue;
    (r.l === 2 ? t.yes : t.maybe).push(r.p);
    t.count++;
  }
  return map;
}

export interface Block {
  start: string;
  end: string; // exclusive, UTC ISO
  slots: number;
  yes: number;
  maybe: number;
  count: number;
}

/**
 * Merge adjacent slots that have the same people into blocks, then rank:
 * most "available", then most "if need be", then longest.
 */
export function bestBlocks(slots: string[], tallies: Map<string, SlotTally>, slotMinutes: number, limit = 5): Block[] {
  const step = slotMinutes * 60_000;
  const sig = (t: SlotTally) => [...t.yes].sort().join(',') + '|' + [...t.maybe].sort().join(',');
  const blocks: Block[] = [];
  let cur: (Block & { sig: string; last: number }) | null = null;
  for (const s of slots) {
    const t = tallies.get(s)!;
    if (t.count === 0) {
      cur = null;
      continue;
    }
    const ms = Date.parse(s);
    const sg = sig(t);
    if (cur && cur.sig === sg && ms - cur.last === step) {
      cur.slots++;
      cur.last = ms;
      cur.end = new Date(ms + step).toISOString().replace('.000Z', 'Z');
    } else {
      cur = {
        start: s,
        end: new Date(ms + step).toISOString().replace('.000Z', 'Z'),
        slots: 1,
        yes: t.yes.length,
        maybe: t.maybe.length,
        count: t.count,
        sig: sg,
        last: ms,
      };
      blocks.push(cur);
    }
  }
  return blocks
    .sort((a, b) => b.yes - a.yes || b.maybe - a.maybe || b.slots - a.slots || a.start.localeCompare(b.start))
    .slice(0, limit)
    .map(({ start, end, slots: n, yes, maybe, count }) => ({ start, end, slots: n, yes, maybe, count }));
}

export function namesFor(ids: string[], people: Participant[]): string[] {
  const m = new Map(people.map((p) => [p.id, p.name]));
  return ids.map((i) => m.get(i) ?? '?');
}

export function levelsFor(rows: AvailabilityRow[], participantId: string): Record<string, Level> {
  const out: Record<string, Level> = {};
  for (const r of rows) if (r.p === participantId) out[normIso(r.s)] = r.l;
  return out;
}
