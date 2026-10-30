import { describe, expect, it } from 'vitest';
import { bestBlocks, tally } from '../lib/aggregate';
import { buildIcs } from '../lib/ics';

const slots = ['2026-11-10T01:00:00Z', '2026-11-10T01:30:00Z', '2026-11-10T02:00:00Z', '2026-11-10T02:30:00Z'];

describe('aggregate', () => {
  const rows = [
    { p: 'a', s: slots[0], l: 2 as const },
    { p: 'b', s: slots[0], l: 2 as const },
    { p: 'a', s: slots[1], l: 2 as const },
    { p: 'b', s: slots[1], l: 2 as const },
    { p: 'a', s: slots[2], l: 2 as const },
    { p: 'b', s: slots[2], l: 1 as const },
  ];
  it('tallies available and if-need-be', () => {
    const t = tally(slots, rows);
    expect(t.get(slots[0])!.yes).toEqual(['a', 'b']);
    expect(t.get(slots[2])!.maybe).toEqual(['b']);
    expect(t.get(slots[3])!.count).toBe(0);
  });
  it('merges identical neighbours and ranks by availability', () => {
    const b = bestBlocks(slots, tally(slots, rows), 30);
    expect(b[0]).toMatchObject({ start: slots[0], end: '2026-11-10T02:00:00Z', slots: 2, yes: 2 });
    expect(b).toHaveLength(2);
  });
});

describe('ics', () => {
  it('writes UTC times, link and alarms', () => {
    const s = buildIcs({ uid: 'x', title: 'GRB sync, weekly', startIso: slots[0], endIso: slots[1], url: 'https://meet.example/abc', alarmMinutes: [60] });
    expect(s).toContain('DTSTART:20261110T010000Z');
    expect(s).toContain('SUMMARY:GRB sync\\, weekly');
    expect(s).toContain('URL:https://meet.example/abc');
    expect(s).toContain('TRIGGER:-PT60M');
    expect(s.endsWith('\r\n')).toBe(true);
  });
});
