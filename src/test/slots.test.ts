import { describe, expect, it } from 'vitest';
import { buildGrid, generateSlots, normIso } from '../lib/slots';

const base = { dates: ['2026-11-10'], day_start_min: 540, day_end_min: 1080, slot_minutes: 30, timezone: 'Asia/Shanghai' };

describe('generateSlots', () => {
  it('makes 18 half-hour slots, first at 01:00Z for 09:00 Shanghai', () => {
    const s = generateSlots(base);
    expect(s).toHaveLength(18);
    expect(s[0]).toBe('2026-11-10T01:00:00Z');
    expect(s[17]).toBe('2026-11-10T09:30:00Z');
  });
  it('handles a DST fall-back day without duplicates, in order', () => {
    const s = generateSlots({ ...base, dates: ['2026-11-01'], timezone: 'America/New_York', day_start_min: 0, day_end_min: 300, slot_minutes: 60 });
    expect(new Set(s).size).toBe(s.length);
    expect([...s].sort()).toEqual(s);
  });
  it('skips nothing on a normal day across zones', () => {
    expect(generateSlots({ ...base, timezone: 'Asia/Kolkata' })[0]).toBe('2026-11-10T03:30:00Z');
  });
});

describe('buildGrid', () => {
  it('shows a Shanghai event in Kolkata time', () => {
    const g = buildGrid(generateSlots(base), 'Asia/Kolkata');
    expect(g.rows[0].label).toBe('06:30');
    expect(g.cols).toHaveLength(1);
    expect(g.cells[0][0]).toBe('2026-11-10T01:00:00Z');
  });
  it('splits into two local days when the viewer zone crosses midnight', () => {
    const g = buildGrid(generateSlots({ ...base, day_start_min: 1260, day_end_min: 1440 }), 'America/New_York');
    expect(g.cols.length).toBe(1);
    const late = buildGrid(generateSlots({ ...base, day_start_min: 1260, day_end_min: 1440 }), 'Asia/Tokyo');
    expect(late.cols.length).toBe(2);
  });
});

describe('normIso', () => {
  it('normalizes Postgres style timestamps', () => {
    expect(normIso('2026-11-10T01:00:00+00:00')).toBe('2026-11-10T01:00:00Z');
    expect(normIso('2026-11-10T09:00:00+08:00')).toBe('2026-11-10T01:00:00Z');
  });
});
