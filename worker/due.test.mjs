import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, dueOffsets, humanOffset } from './due.mjs';

const START = Date.parse('2026-11-10T01:00:00Z');
const min = (m) => m * 60_000;

test('nothing due long before', () => {
  assert.deepEqual(plan(START, [1440, 60], START - min(3000), new Set()), { send: null, markSent: [] });
});
test('1 day reminder at T-1440', () => {
  assert.deepEqual(plan(START, [1440, 60], START - min(1439), new Set()), { send: 1440, markSent: [1440] });
});
test('does not repeat', () => {
  assert.deepEqual(plan(START, [1440, 60], START - min(1000), new Set([1440])), { send: null, markSent: [] });
});
test('1 hour reminder after the day one', () => {
  assert.deepEqual(plan(START, [1440, 60], START - min(59), new Set([1440])), { send: 60, markSent: [60] });
});
test('late finalize sends only the closest reminder once', () => {
  const r = plan(START, [1440, 60], START - min(30), new Set());
  assert.equal(r.send, 60);
  assert.deepEqual(r.markSent.sort((a, b) => a - b), [60, 1440]);
});
test('nothing after the meeting started', () => {
  assert.deepEqual(dueOffsets(START, [60], START + 1), []);
});
test('humanOffset', () => {
  assert.equal(humanOffset(1440), '1 day');
  assert.equal(humanOffset(60), '1 hour');
  assert.equal(humanOffset(15), '15 minutes');
});
